import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { LiveServerMessage, Modality, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  CAREER_CATALOG,
  buildCareerVideoSessionTemplates,
  buildDefaultRoadmapForCareer,
} from './src/data/careers.ts';
import {
  FREE_LIVE_MODEL,
  FREE_TTS_MODEL,
  PRIMARY_FREE_TEXT_MODEL,
  SCENE_SCRIPT_MIME_TYPE,
  dedupeAsync,
  generateContentWithRateLimitHandling,
  getCachedValue,
  getGeminiClient,
  inspectAvailableModels,
  parseGeminiApiError,
  setCachedValue,
} from './src/lib/gemini.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { isInterviewCompleted } from './src/lib/rbac.ts';
import { requireAdmin, requireAuth, requireStudentOnly, AuthRequest } from './src/middleware/auth.ts';
import {
  createAdminInvitation,
  deleteManagedCareer,
  deleteManagedEnvironment,
  deleteManagedMission,
  deleteManagedRoadmap,
  getAdminOverviewAnalytics,
  getAdminSecurityStatus,
  getPlatformConfigData,
  listAdminInvitations,
  listManagedCareers,
  listManagedEnvironments,
  listManagedMissions,
  listManagedRoadmaps,
  listStudentsForAdmin,
  revokeAdminInvitation,
  updateAdminPasscodeForUser,
  updateInterviewSettings,
  updateRecommendationSettings,
  updateStudentAccountControl,
  updateSystemIssues,
  upsertManagedCareer,
  upsertManagedEnvironment,
  upsertManagedMission,
  upsertManagedRoadmap,
  verifyAdminPortalLogin,
} from './src/db/admin.ts';
import { db } from './src/db/index.ts';
import { users } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';
import {
  findCachedCareerVideoSession,
  getOrCreateUser,
  getWorkspaceForUser,
  listCachedCareerVideoSessions,
  listCareerVideosForUser,
  saveCareerVideo,
  saveCareerVideoSession,
  saveWorkspaceForUser,
} from './src/db/users.ts';
import type {
  AbilityAssessmentReport,
  AbilityQuestionAnswer,
  AbilityQuestionItem,
  AccountStatus,
  AdminInterviewSettings,
  AdminPermission,
  AdminRecommendationSettings,
  AdminSystemIssue,
  AnimatedSceneScript,
  CareerRecommendation,
  CareerVideoCheckpoint,
  CareerVideoSessionPlan,
  CareerVideoSubtitleCue,
  InterviewState,
  ManagedCareerRecord,
  ManagedEnvironmentRecord,
  ManagedMissionRecord,
  ManagedRoadmapRecord,
  ProgressAnalytics,
  RoadmapStage,
  StudentProfile,
  StudentWorkspaceState,
  UserRole,
  VideoInterviewReport,
} from './src/types.ts';

dotenv.config();

const PORT = 3000;

const INTERVIEW_PHASES = [
  { phase: 1, label: 'AI Introduction & Interests' },
  { phase: 2, label: 'Strengths & Work Preferences' },
  { phase: 3, label: 'Situational Scenario 1: Ambiguity' },
  { phase: 4, label: 'Situational Scenario 2: Collaboration' },
  { phase: 5, label: 'Ability Synthesis & Evaluation' },
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  const server = http.createServer(app);

  // Health & Free Tier Gemini model check
  app.get('/api/health', async (req, res) => {
    const runProbe = req.query.probe === '1';
    if (runProbe) {
      const summary = await inspectAvailableModels(true);
      return res.json({
        ok: true,
        geminiConfigured: Boolean(getGeminiClient()),
        ...summary,
      });
    }
    res.json({
      ok: true,
      geminiConfigured: Boolean(getGeminiClient()),
      primaryTextModel: PRIMARY_FREE_TEXT_MODEL,
    });
  });

  app.get('/api/ai/status', requireAuth, async (req, res) => {
    const runProbe = req.query.probe === '1';
    const summary = await inspectAvailableModels(runProbe);
    res.json(summary);
  });

  // --- WORKSPACE STATE ROUTES (PostgreSQL + Firebase Auth) ---
  app.get('/api/state', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser!;
      const workspace = await getWorkspaceForUser(dbUser.id, dbUser.email, dbUser.fullName);
      res.json({
        user: {
          uid: dbUser.uid,
          email: dbUser.email,
          fullName: dbUser.fullName,
          role: dbUser.role,
          status: dbUser.status,
          permissions: dbUser.permissions,
          avatarUrl: dbUser.avatarUrl,
        },
        workspace,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load workspace';
      res.status(500).json({ error: message });
    }
  });

  // --- LIVE PLATFORM CATALOG ROUTE ---
  app.get('/api/catalog', requireAuth, async (_req: AuthRequest, res) => {
    try {
      const [careers, environments, roadmaps] = await Promise.all([
        listManagedCareers(false),
        listManagedEnvironments(),
        listManagedRoadmaps(),
      ]);
      res.json({ careers, environments, roadmaps });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load catalog';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/state', requireAuth, requireStudentOnly, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser!;
      const nextState = req.body?.workspace as StudentWorkspaceState | undefined;
      if (!nextState) {
        return res.status(400).json({ error: 'Workspace payload required.' });
      }
      // Explicitly ignore any untrusted role/permission properties sent from client
      const sanitizedState: StudentWorkspaceState = {
        profile: nextState.profile,
        interview: nextState.interview,
        recommendations: nextState.recommendations,
        selectedCareerId: nextState.selectedCareerId,
        compareCareerIds: nextState.compareCareerIds,
        roadmap: nextState.roadmap,
        completedMissionIds: nextState.completedMissionIds,
        missionResults: nextState.missionResults,
        skills: nextState.skills,
        unlockedBuildingIds: nextState.unlockedBuildingIds,
        watchedVideoSessionIds: Array.isArray(nextState.watchedVideoSessionIds)
          ? nextState.watchedVideoSessionIds
          : [],
        completed3DActivityIds: Array.isArray(nextState.completed3DActivityIds)
          ? nextState.completed3DActivityIds
          : [],
        mentorHistory: nextState.mentorHistory,
        satisfactionStatus: nextState.satisfactionStatus,
        advancedUnlocked: nextState.advancedUnlocked,
        progressAnalytics: nextState.progressAnalytics,
        updatedAt: nextState.updatedAt,
      };
      const saved = await saveWorkspaceForUser(dbUser.id, sanitizedState);
      res.json({ workspace: saved });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save workspace';
      res.status(500).json({ error: message });
    }
  });

  // --- AI INTERVIEW ROUTE ---
  app.post('/api/ai/interview', requireAuth, async (req: AuthRequest, res) => {
    const { profile, messages, studentReply, startFresh } = req.body as {
      profile: StudentProfile;
      messages: { role: 'ai' | 'student'; content: string }[];
      studentReply?: string;
      startFresh?: boolean;
    };

    const history = startFresh ? [] : [...(messages || [])];
    if (studentReply && studentReply.trim()) {
      history.push({ role: 'student', content: studentReply.trim() });
    }

    const studentTurnCount = history.filter((m) => m.role === 'student').length;
    const currentPhaseIdx = Math.min(studentTurnCount, INTERVIEW_PHASES.length - 1);
    const phaseMeta = INTERVIEW_PHASES[currentPhaseIdx];
    const shouldComplete = studentTurnCount >= 10;

    const ai = getGeminiClient();
    if (ai) {
      try {
        const transcriptText = history
          .map((m) => `${m.role === 'ai' ? 'VECTORA AI' : 'Student'}: ${m.content}`)
          .join('\n');

        const prompt = `
You are VECTORA, a warm, encouraging AI career guidance interviewer helping a student after 10th or 12th grade.
Student Profile:
- Name: ${profile.fullName}
- Current Stage: ${profile.educationStage}
- Academic Stream: ${profile.academicStream}
- Top Subjects: ${(profile.topSubjects || []).join(', ')}
- Curiosities: ${profile.curiosities || 'Exploring'}
- Work Preference: ${profile.workPreference}
- Long-Term Goal: ${profile.longTermGoal || 'Undecided'}

Interview Transcript So Far:
${transcriptText || '(Start of interview — no messages yet)'}

Current Step: Turn ${studentTurnCount + 1} (Phase ${phaseMeta.phase} of 5: ${phaseMeta.label}).
Cover these 10 core discovery areas naturally one question at a time:
1) Interests & hobbies, 2) Favourite subjects, 3) Activities enjoyed, 4) Preferred working environment, 5) Domain interest (technology, healthcare, business, creativity, education, public service, environment, aviation), 6) Problem-solving style, 7) Personal strengths, 8) Challenging activities, 9) Preferred future lifestyle, 10) Long-term career aspirations.
If the student says they want a question explained differently, rephrase clearly and warmly. If they pass a question, move warmly to the next topic without inventing an answer.

${
  studentTurnCount === 0
    ? 'Start with the EXACT opening greeting: "Hello! Welcome to VECTORA. I\'m your personal career guidance assistant. Don\'t worry, this isn\'t an examination, and there are no right or wrong answers. I am here to understand your interests, strengths, and the kind of future you imagine for yourself. Let\'s have a friendly conversation. Are you ready to begin?" followed by a friendly first question about their interests and hobbies.'
    : studentTurnCount < 10
      ? 'Reflect warmly on their previous answer in 1 sentence and ask ONE clear next question from the discovery areas above (or an adaptive follow-up).'
      : 'The conversation is complete! Warmly thank the student, summarize their strengths, areas to improve, and demonstrated abilities, and set isComplete=true.'
}

Return valid JSON matching the schema.`;

        const { response } = await generateContentWithRateLimitHandling(
          ai,
          {
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  reply: { type: Type.STRING },
                  suggestedReplies: { type: Type.ARRAY, items: { type: Type.STRING } },
                  isComplete: { type: Type.BOOLEAN },
                  interestsSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
                  strengthsSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
                  demonstratedAbilities: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        level: { type: Type.INTEGER },
                        evidence: { type: Type.STRING },
                      },
                    },
                  },
                },
                required: ['reply', 'suggestedReplies', 'isComplete'],
              },
            },
          },
          { lowThinking: true }
        );

        const parsed = JSON.parse((response.text ?? '{}').trim());
        return res.json({
          reply: parsed.reply,
          phase: phaseMeta.phase,
          phaseLabel: phaseMeta.label,
          isComplete: shouldComplete ? true : Boolean(parsed.isComplete),
          suggestedReplies: Array.isArray(parsed.suggestedReplies)
            ? parsed.suggestedReplies.slice(0, 3)
            : [],
          interestsSummary: Array.isArray(parsed.interestsSummary) ? parsed.interestsSummary : [],
          strengthsSummary: Array.isArray(parsed.strengthsSummary) ? parsed.strengthsSummary : [],
          demonstratedAbilities: Array.isArray(parsed.demonstratedAbilities)
            ? parsed.demonstratedAbilities
            : [],
        });
      } catch (err) {
        console.error('Gemini interview fallback triggered:', parseGeminiApiError(err).userMessage);
      }
    }

    const fallbackResponses = [
      {
        reply: `Hello! Welcome to VECTORA. I'm your personal career guidance assistant. Don't worry, this isn't an examination, and there are no right or wrong answers. I am here to understand your interests, strengths, and the kind of future you imagine for yourself. Let's have a friendly conversation. Are you ready to begin? To start, what hobbies or activities make you lose track of time outside of textbooks?`,
        suggestedReplies: [
          'Building software tools, gadgets, or solving logic puzzles',
          'Sketching, visual storytelling, or designing creative projects',
          'Helping friends learn concepts, debating, or organizing events',
        ],
        isComplete: false,
      },
      {
        reply: `That gives me a great signal about your interests. Next, let us look at your strengths and work preferences: when tackling a tough new challenge, do you prefer structured analytical rigor, hands-on experimentation, or collaborative synthesis with people?`,
        suggestedReplies: [
          'Structured analytical decomposition and mathematical modeling',
          'Hands-on prototyping, testing, and iterating quickly',
          'Synthesizing people, research, and strategy into clear communication',
        ],
        isComplete: false,
      },
      {
        reply: `Helpful insight! Now for a situational check: imagine you are leading a 3-person team with 48 hours before a regional competition, and your primary prototype breaks unexpectedly. How do you decide what to cut, what to fix, and how do you communicate with your team?`,
        suggestedReplies: [
          'Triage root cause, scope down to a reliable core demo, and assign clear recovery roles',
          'Analyze telemetry logs first to preserve technical integrity even if features stay minimal',
          'Reframe the presentation around the validated research findings and live working module',
        ],
        isComplete: false,
      },
      {
        reply: `Strong crisis triage. One final situational scenario: you discover a flaw in a project that everyone else thinks is ready to ship—fixing it delays launch by a week, while ignoring it creates long-term risk for users. What do you do?`,
        suggestedReplies: [
          'Document the exact failure risk with evidence and propose a scoped mitigation fix before launch',
          'Build a quick automated check to isolate the edge case and present options to stakeholders',
        ],
        isComplete: false,
      },
      {
        reply: `Thank you, ${profile.fullName}. I have evaluated your responses across interests, working preferences, and situational judgment. You demonstrated clear structured reasoning, calm prioritization under pressure, and strong ownership. Ready to view your ranked Career Match Results!`,
        suggestedReplies: [],
        isComplete: true,
        interestsSummary: [profile.academicStream, ...(profile.topSubjects || []).slice(0, 2)],
        strengthsSummary: ['Structured Problem Triage', 'Principled Decision Making', 'Systems Curiosity'],
        demonstratedAbilities: [
          { name: 'Analytical Reasoning', level: 84, evidence: 'Broke down ambiguous constraints systematically.' },
          { name: 'Systems & Structural Thinking', level: 80, evidence: 'Balanced core reliability against deadline scope.' },
          { name: 'Communication & Alignment', level: 78, evidence: 'Articulated clear trade-offs for stakeholders.' },
          { name: 'Ethical & Risk Judgment', level: 85, evidence: 'Prioritized user safety and verification before launch.' },
        ],
      },
    ];

    const fb = fallbackResponses[Math.min(studentTurnCount, fallbackResponses.length - 1)];
    return res.json({
      reply: fb.reply,
      phase: phaseMeta.phase,
      phaseLabel: phaseMeta.label,
      isComplete: fb.isComplete,
      suggestedReplies: fb.suggestedReplies,
      interestsSummary: fb.interestsSummary || [],
      strengthsSummary: fb.strengthsSummary || [],
      demonstratedAbilities: fb.demonstratedAbilities || [],
    });
  });

  // --- MULTIMODAL VIDEO INTERVIEW PERFORMANCE REPORT ROUTE ---
  app.post('/api/ai/evaluate-video-interview', requireAuth, async (req: AuthRequest, res) => {
    const { profile, transcript, videoFrames, durationSeconds, cameraEnabled } = req.body as {
      profile: StudentProfile;
      transcript: { speaker: 'AI' | 'Student'; text: string }[];
      videoFrames: string[];
      durationSeconds: number;
      cameraEnabled: boolean;
    };

    if (!Array.isArray(transcript) || transcript.length === 0) {
      return res.status(400).json({
        error: 'No spoken interview conversation was captured yet. Answer at least one question before generating your report.',
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured. Please verify your key in Settings > Secrets.',
      });
    }

    try {
      const formattedTranscript = transcript
        .map((t) => `${t.speaker === 'AI' ? 'AI Interviewer' : 'Student'}: ${t.text}`)
        .join('\n');

      const safeFrames = Array.isArray(videoFrames) ? videoFrames.slice(0, 6) : [];
      const imageParts = safeFrames.map((data) => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data,
        },
      }));

      const promptText = `
You are VECTORA's supportive human-style career guidance assessor reviewing a student's interview session.

Student Baseline Profile:
- Name: ${profile.fullName}
- Stage: ${profile.educationStage}
- Stream: ${profile.academicStream}
- Top Subjects: ${(profile.topSubjects || []).join(', ')}
- Curiosities: ${profile.curiosities || 'Exploring'}
- Work Preference: ${profile.workPreference}

Call Telemetry:
- Duration: ${Math.max(1, Math.round(durationSeconds || 0))} seconds
- Camera Video Frames Provided: ${safeFrames.length} frames (cameraEnabled=${Boolean(cameraEnabled)})

Verbatim Interview Transcript (Audio Speech-to-Text):
${formattedTranscript}

Evaluation & Ethical Rules (CRITICAL):
1. Evaluate four core verbal/cognitive dimensions solely from the student's actual spoken answers and transcript (0-100 each):
   - communicationSkills: clarity, articulation, structure, conciseness, and how well they explained ideas.
   - subjectKnowledge: accuracy, conceptual depth across their subjects/interests, and real-world grounding.
   - confidence: decisiveness and clarity of reasoning when explaining preferences or answering follow-ups (based strictly on verbal reasoning, NOT facial expressions).
   - responseQuality: relevance, completeness, examples provided, analytical thinking, and problem-solving approach.
2. In nonVerbalAnalysis, provide strictly SUPPORTIVE, NON-SCORING COMMUNICATION OBSERVATIONS only (NEVER claim to measure intelligence, personality, emotion, or career suitability from facial expressions or body language; clearly frame visual notes as helpful camera/presentation tips):
   - bodyLanguage: Camera framing and comfortable posture visibility (if camera was off, note "Camera off — audio-only mode used").
   - eyeContact: Facing the camera/screen naturally for clearer communication.
   - facialExpressions: Visible engagement and natural conversational pacing (never judge emotions or intelligence).
   - speakingConfidence: Speech clarity, audibility, and steady pacing across answers.
3. In followUpEvaluation, summarize the student's career interests, strengths, areas to improve, and how they handled follow-ups or skipped questions (never invent answers for skipped questions).
4. Provide 3-4 concrete keyStrengths, 3-4 constructive improvementPlan steps ("Areas to Improve"), plus demonstratedAbilities (name, level 0-100, evidence), interestsSummary, and strengthsSummary.

Return strict JSON matching the schema.`;

      const dimSchema = {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.INTEGER },
          feedback: { type: Type.STRING },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['score', 'feedback', 'suggestions'],
      };

      const nonVerbalSchema = {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.INTEGER },
          observation: { type: Type.STRING },
          suggestion: { type: Type.STRING },
        },
        required: ['score', 'observation', 'suggestion'],
      };

      const { response } = await generateContentWithRateLimitHandling(
        ai,
        {
          contents: {
            parts: [...imageParts, { text: promptText }],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                overallScore: { type: Type.INTEGER },
                overallVerdict: { type: Type.STRING },
                communicationSkills: dimSchema,
                subjectKnowledge: dimSchema,
                confidence: dimSchema,
                responseQuality: dimSchema,
                nonVerbalAnalysis: {
                  type: Type.OBJECT,
                  properties: {
                    bodyLanguage: nonVerbalSchema,
                    eyeContact: nonVerbalSchema,
                    facialExpressions: nonVerbalSchema,
                    speakingConfidence: nonVerbalSchema,
                  },
                  required: ['bodyLanguage', 'eyeContact', 'facialExpressions', 'speakingConfidence'],
                },
                followUpEvaluation: { type: Type.STRING },
                keyStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                improvementPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
                demonstratedAbilities: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      level: { type: Type.INTEGER },
                      evidence: { type: Type.STRING },
                    },
                    required: ['name', 'level', 'evidence'],
                  },
                },
                interestsSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
                strengthsSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: [
                'overallScore',
                'overallVerdict',
                'communicationSkills',
                'subjectKnowledge',
                'confidence',
                'responseQuality',
                'nonVerbalAnalysis',
                'followUpEvaluation',
                'keyStrengths',
                'improvementPlan',
                'demonstratedAbilities',
                'interestsSummary',
                'strengthsSummary',
              ],
            },
          },
        },
        { lowThinking: true }
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Omit<
        VideoInterviewReport,
        'durationSeconds' | 'cameraAnalyzed' | 'generatedAt'
      >;

      const report: VideoInterviewReport = {
        ...parsed,
        durationSeconds: Math.max(1, Math.round(durationSeconds || 0)),
        cameraAnalyzed: safeFrames.length > 0,
        generatedAt: new Date().toISOString(),
      };

      return res.json({ report });
    } catch (error: unknown) {
      const parsedErr = parseGeminiApiError(error);
      console.error('Gemini video interview evaluation error:', parsedErr.rawMessage);
      return res.status(parsedErr.status).json({
        error: parsedErr.userMessage,
        code: parsedErr.code,
        retryAfterSeconds: parsedErr.retryAfterSeconds,
      });
    }
  });

  // --- AI ABILITY QUESTIONS GENERATOR (Direct Q&A Ability Check) ---
  app.post('/api/ai/ability-questions', requireAuth, async (req: AuthRequest, res) => {
    const { profile } = req.body as { profile: StudentProfile };
    if (!profile) {
      return res.status(400).json({ error: 'Student profile is required.' });
    }

    const ai = getGeminiClient();
    if (ai) {
      try {
        const prompt = `
You are Vectora's AI Career Assessment Designer.
Instead of putting the student through a formal live interview, generate 5 clear, focused Ability-Check Questions for the AI to ask the student directly so we can accurately measure their abilities.

Student Profile:
- Name: ${profile.fullName}
- Stage: ${profile.educationStage}
- Academic Stream: ${profile.academicStream}
- Top Subjects: ${(profile.topSubjects || []).join(', ')}
- Curiosities: ${profile.curiosities || 'Exploring applied problem-solving'}
- Work Preference: ${profile.workPreference}

Design 5 targeted questions covering these 5 exact ability dimensions:
1. "Analytical & Quantitative Reasoning"
2. "Core Subject Application (${profile.topSubjects?.[0] || profile.academicStream})"
3. "Systems & Structured Problem Solving"
4. "Situational Judgment & Trade-offs"
5. "Communication & Stakeholder Alignment"

For each question:
- id: "aq_1" .. "aq_5"
- abilityDimension: clear dimension name
- context: 1-2 sentence realistic scenario grounded in the student's academic stage and subjects
- question: clear, direct question from the AI to check their ability
- options: array of 4 plausible decision approaches (1 best-practice/strongest analytical choice at index correctOptionIndex, plus 3 plausible but suboptimal distractors)
- correctOptionIndex: integer 0-3 indicating the strongest choice

Return strict JSON matching the schema.`;

        const { response } = await generateContentWithRateLimitHandling(
          ai,
          {
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        abilityDimension: { type: Type.STRING },
                        context: { type: Type.STRING },
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctOptionIndex: { type: Type.INTEGER },
                      },
                      required: ['id', 'abilityDimension', 'context', 'question', 'options', 'correctOptionIndex'],
                    },
                  },
                },
                required: ['questions'],
              },
            },
          },
          { lowThinking: true }
        );

        const parsed = JSON.parse((response.text ?? '{}').trim()) as {
          questions?: AbilityQuestionItem[];
        };
        if (Array.isArray(parsed.questions) && parsed.questions.length >= 4) {
          return res.json({ questions: parsed.questions.slice(0, 5) });
        }
      } catch (err) {
        console.error('Gemini ability-questions fallback triggered:', parseGeminiApiError(err).userMessage);
      }
    }

    const subj = profile.topSubjects[0] || profile.academicStream;
    const fallbackQuestions: AbilityQuestionItem[] = [
      {
        id: 'aq_1',
        abilityDimension: 'Analytical & Quantitative Reasoning',
        context: `You are analyzing two competing metrics for a ${profile.academicStream} study: one shows high short-term averages while the other reveals rising variance across edge cases.`,
        question: 'Which diagnostic step gives you the most reliable conclusion first?',
        options: [
          'Segment the data by subgroup and inspect outliers alongside median performance before choosing a model',
          'Use only the highest single average score because it looks strongest in a summary chart',
          'Discard the outlier records automatically so the remaining variance appears smaller',
          'Wait until more anecdotes arrive before looking at any quantitative distribution',
        ],
        correctOptionIndex: 0,
      },
      {
        id: 'aq_2',
        abilityDimension: `Core Subject Application (${subj})`,
        context: `Your ${subj} instructor asks you to verify whether a textbook formula or framework still holds under real-world boundary constraints.`,
        question: 'How do you test and validate your understanding effectively?',
        options: [
          'Repeat the memorized steps on identical sample numbers from class notes',
          'Derive extreme boundary cases, run a small counter-example test, and check which assumptions break',
          'Assume textbook assumptions always apply identically in live environments',
          'Ask teammates to pick whichever conclusion feels most familiar',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'aq_3',
        abilityDimension: 'Systems & Structured Problem Solving',
        context: `With 48 hours before a ${profile.educationStage} capstone evaluation, a multi-part prototype fails intermittently during integration.`,
        question: 'What is the smartest engineering or research troubleshooting sequence?',
        options: [
          'Rewrite the entire codebase or experiment from scratch immediately',
          'Hide the failing component during the presentation and hope no one asks',
          'Isolate subsystems one interface at a time, reproduce the failure deterministically, and fix the bottleneck',
          'Keep changing random parameters until one run passes without logging what changed',
        ],
        correctOptionIndex: 2,
      },
      {
        id: 'aq_4',
        abilityDimension: 'Situational Judgment & Trade-offs',
        context: `Your team can ship a flashy extra feature tonight or spend that time adding automated validation and accuracy checks for users.`,
        question: 'How should you decide under strict deadline constraints?',
        options: [
          'Build the flashy add-on first and leave accuracy verification for after public release',
          'Prioritize core reliability and automated verification while scoping down non-essential extras clearly',
          'Delay communicating the trade-off to stakeholders until after the deadline passes',
          'Let each member independently ship unreviewed changes without coordination',
        ],
        correctOptionIndex: 1,
      },
      {
        id: 'aq_5',
        abilityDimension: 'Communication & Stakeholder Alignment',
        context: `You need to explain a complex technical or analytical trade-off from ${profile.academicStream} to non-specialist mentors deciding project funding.`,
        question: 'What structure makes your recommendation clearest and most persuasive?',
        options: [
          'Lead with dense jargon and raw formulas so the presentation sounds advanced',
          'Skip the risks completely and present only optimistic guesses',
          'State the core decision first, connect evidence to real user/project impact, and outline clear next metrics',
          'Read every slide verbatim without checking whether the audience follows the premise',
        ],
        correctOptionIndex: 2,
      },
    ];

    return res.json({ questions: fallbackQuestions });
  });

  // --- AI ABILITY QUESTIONS EVALUATION ROUTE ---
  app.post('/api/ai/evaluate-ability-questions', requireAuth, async (req: AuthRequest, res) => {
    const { profile, questions, answers } = req.body as {
      profile: StudentProfile;
      questions: AbilityQuestionItem[];
      answers: AbilityQuestionAnswer[];
    };

    if (!Array.isArray(questions) || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'Questions and student answers are required.' });
    }

    const answerMap = new Map(answers.map((a) => [a.questionId, a]));

    const ai = getGeminiClient();
    if (ai) {
      try {
        const qaSummary = questions.map((q) => {
          const ans = answerMap.get(q.id);
          const chosenText =
            ans && q.options[ans.selectedOptionIndex] ? q.options[ans.selectedOptionIndex] : 'No selection';
          const isBestOption =
            typeof q.correctOptionIndex === 'number' && ans?.selectedOptionIndex === q.correctOptionIndex;
          return {
            questionId: q.id,
            abilityDimension: q.abilityDimension,
            question: q.question,
            chosenOption: chosenText,
            matchedStrongestOption: isBestOption,
            writtenExplanation: ans?.writtenExplanation || '',
          };
        });

        const prompt = `
Evaluate this student's direct answers to the 5 AI-asked ability questions so we can score their abilities and recommend the best careers without needing a formal interview.

Student Profile:
- Name: ${profile.fullName}
- Stage: ${profile.educationStage}
- Stream: ${profile.academicStream}
- Top Subjects: ${profile.topSubjects.join(', ')}
- Work Preference: ${profile.workPreference}

Question & Answer Responses:
${JSON.stringify(qaSummary, null, 2)}

Scoring Instructions:
1. Score each question accurately (0-100) based on both their option choice (strong boost if matchedStrongestOption=true) and any written reasoning provided.
2. Compute overallScore (0-100) and a crisp 2-sentence summary.
3. Produce demonstratedAbilities (4-5 core abilities with score 0-100 and concise evidence referencing their actual choices/reasoning), plus 3 interestsSummary items and 3 strengthsSummary items.
Return strict JSON matching the schema.`;

        const { response } = await generateContentWithRateLimitHandling(
          ai,
          {
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  overallScore: { type: Type.INTEGER },
                  summary: { type: Type.STRING },
                  questionBreakdown: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        questionId: { type: Type.STRING },
                        abilityDimension: { type: Type.STRING },
                        score: { type: Type.INTEGER },
                        feedback: { type: Type.STRING },
                      },
                      required: ['questionId', 'abilityDimension', 'score', 'feedback'],
                    },
                  },
                  demonstratedAbilities: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        level: { type: Type.INTEGER },
                        evidence: { type: Type.STRING },
                      },
                      required: ['name', 'level', 'evidence'],
                    },
                  },
                  interestsSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
                  strengthsSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'overallScore',
                  'summary',
                  'questionBreakdown',
                  'demonstratedAbilities',
                  'interestsSummary',
                  'strengthsSummary',
                ],
              },
            },
          },
          { lowThinking: true }
        );

        const parsed = JSON.parse((response.text ?? '{}').trim()) as Omit<
          AbilityAssessmentReport,
          'generatedAt'
        >;
        if (Array.isArray(parsed.demonstratedAbilities) && parsed.demonstratedAbilities.length > 0) {
          return res.json({
            assessment: {
              ...parsed,
              generatedAt: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.error('Gemini evaluate-ability-questions fallback triggered:', parseGeminiApiError(err).userMessage);
      }
    }

    // Deterministic fallback evaluator
    const questionBreakdown = questions.map((q) => {
      const ans = answerMap.get(q.id);
      const isRight =
        typeof q.correctOptionIndex === 'number' && ans?.selectedOptionIndex === q.correctOptionIndex;
      const hasReasoning = (ans?.writtenExplanation || '').trim().length >= 15;
      const score = isRight ? (hasReasoning ? 92 : 84) : hasReasoning ? 68 : 58;
      return {
        questionId: q.id,
        abilityDimension: q.abilityDimension,
        score,
        feedback: isRight
          ? `Strong reasoning in ${q.abilityDimension} — prioritized structured evidence and reliability.`
          : `Consider verifying edge cases and core trade-offs more systematically in ${q.abilityDimension}.`,
      };
    });

    const overallScore = Math.round(
      questionBreakdown.reduce((sum, q) => sum + q.score, 0) / Math.max(1, questionBreakdown.length)
    );

    const assessment: AbilityAssessmentReport = {
      overallScore,
      summary: `Completed all ${questions.length} AI ability-check questions with an overall readiness score of ${overallScore}/100 across ${profile.academicStream} reasoning, problem decomposition, and communication.`,
      questionBreakdown,
      demonstratedAbilities: questionBreakdown.map((item) => ({
        name: item.abilityDimension.split('(')[0].trim(),
        level: item.score,
        evidence: item.feedback,
      })),
      interestsSummary: [profile.academicStream, ...profile.topSubjects.slice(0, 2)],
      strengthsSummary: questionBreakdown
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((q) => q.abilityDimension.split('(')[0].trim()),
      generatedAt: new Date().toISOString(),
    };

    return res.json({ assessment });
  });

  // --- AI CAREER MATCH & RANKING ROUTE ---
  app.post('/api/ai/recommend-careers', requireAuth, async (req: AuthRequest, res) => {
    const dbUser = req.dbUser!;
    const ws = await getWorkspaceForUser(dbUser.id, dbUser.email, dbUser.fullName);
    if (dbUser.role === 'student' && !isInterviewCompleted(ws.interview)) {
      return res.status(403).json({
        error: 'Forbidden: Complete the required AI interview before accessing career exploration.',
      });
    }

    const { profile, interview } = req.body as {
      profile: StudentProfile;
      interview: InterviewState;
    };

    const liveCareers = await listManagedCareers(false);
    const activeCatalog = liveCareers.length > 0 ? liveCareers : CAREER_CATALOG;
    const platformCfg = await getPlatformConfigData();
    const weights = platformCfg.recommendationSettings.scoringWeights;

    const ai = getGeminiClient();
    if (ai) {
      try {
        const transcript = interview.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
        const catalogSummary = activeCatalog.map((c) => ({
          id: c.id,
          title: c.title,
          domain: c.domain,
          eligibility12th: c.eligibility12th,
          requiredSkills: c.requiredSkills,
        }));

        const prompt = `
Analyze this student's profile and AI interview/ability responses, compare them against all careers in the catalog using admin scoring weights (${JSON.stringify(weights)}), rank the top 6 best-fitting careers, and explain using this guidance: "${platformCfg.recommendationSettings.explanationTemplate}".

Student Profile: ${JSON.stringify(profile)}
Demonstrated Abilities: ${JSON.stringify(interview.demonstratedAbilities)}
Transcript:
${transcript}

Career Catalog:
${JSON.stringify(catalogSummary)}

Return JSON with an array "recommendations" containing 6 items sorted from rank 1 to 6, using exact careerId values from the catalog.`;

        const { response } = await generateContentWithRateLimitHandling(
          ai,
          {
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  recommendations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        careerId: { type: Type.STRING },
                        rank: { type: Type.INTEGER },
                        matchScore: { type: Type.INTEGER },
                        reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
                        alignmentHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                        keyGapsToBridge: { type: Type.ARRAY, items: { type: Type.STRING } },
                        pathwaySummary: { type: Type.STRING },
                      },
                      required: [
                        'careerId',
                        'rank',
                        'matchScore',
                        'reasons',
                        'alignmentHighlights',
                        'keyGapsToBridge',
                        'pathwaySummary',
                      ],
                    },
                  },
                },
                required: ['recommendations'],
              },
            },
          },
          { lowThinking: true }
        );

        const parsed = JSON.parse((response.text ?? '{}').trim());
        const validIds = new Set(activeCatalog.map((c) => c.id));
        const recs = (parsed.recommendations || []).filter((r: CareerRecommendation) =>
          validIds.has(r.careerId)
        );
        if (recs.length >= 3) {
          return res.json({ recommendations: recs });
        }
      } catch (err) {
        console.error('Gemini recommend-careers fallback triggered:', parseGeminiApiError(err).userMessage);
      }
    }

    const combinedText = `${profile.academicStream} ${profile.topSubjects.join(' ')} ${(profile.hobbies || []).join(' ')} ${(profile.preferredActivities || []).join(' ')} ${profile.curiosities} ${profile.workPreference} ${interview.messages.map((m) => m.content).join(' ')}`.toLowerCase();

    const scored = activeCatalog.map((career) => {
      let score = 68;
      if (career.id === 'ai-systems-engineer' && /math|code|software|ai|system|computer|physics|logic/.test(combinedText)) score += 23;
      if (career.id === 'biomedical-architect' && /bio|med|health|chem|clinical|life/.test(combinedText)) score += 24;
      if (career.id === 'product-architect' && /design|visual|prototype|ux|art|people|spatial/.test(combinedText)) score += 22;
      if (career.id === 'quant-finance-strategist' && /finance|econ|market|math|commerce|risk|data/.test(combinedText)) score += 23;
      if (career.id === 'aerospace-robotics' && /physics|robot|aero|mech|hardware|flight|control/.test(combinedText)) score += 22;
      if (career.id === 'climate-sustainability' && /climate|agri|energy|green|earth|sustain|env/.test(combinedText)) score += 21;
      if (career.id === 'tech-policy-law' && /law|policy|ethic|governance|humanities|debate|write|gov/.test(combinedText)) score += 22;
      if (career.id === 'interactive-media-director' && /3d|game|media|story|interactive|creative|graphics/.test(combinedText)) score += 21;
      if (career.id === 'education-research-scientist' && /teach|research|educat|science|academ|study/.test(combinedText)) score += 22;
      if (career.id === 'aviation-hospitality-director' && /aviat|flight|pilot|hotel|hospital|travel|airport/.test(combinedText)) score += 22;
      score = Math.min(96, Math.max(62, score));
      return { career, score };
    }).sort((a, b) => b.score - a.score);

    const recommendations: CareerRecommendation[] = scored.slice(0, 6).map(({ career, score }, idx) => ({
      careerId: career.id,
      rank: idx + 1,
      matchScore: score,
      reasons: [
        `Strong alignment with your ${profile.academicStream} foundation (${profile.topSubjects.slice(0, 2).join(' & ')}).`,
        `Matches your situational preference for "${profile.workPreference.slice(0, 60)}".`,
        `High growth trajectory (${career.growthOutlook}) with clear academic-to-workplace milestones.`,
      ],
      alignmentHighlights: Object.keys(career.requiredSkills).slice(0, 3),
      keyGapsToBridge: [
        `Target entrance readiness (${career.entranceExams[0]})`,
        `Hands-on portfolio depth in ${career.domain}`,
      ],
      pathwaySummary: `${profile.classGrade || profile.educationStage} (${career.entranceExams[0]}) → ${career.recommendedCourses[0]} → ${career.workplaceRoles[0]}`,
    }));

    return res.json({ recommendations });
  });

  // --- PERSONALIZED CAREER ROADMAP ROUTE ---
  app.post('/api/ai/roadmap', requireAuth, async (req: AuthRequest, res) => {
    const dbUser = req.dbUser!;
    const ws = await getWorkspaceForUser(dbUser.id, dbUser.email, dbUser.fullName);
    if (dbUser.role === 'student' && !isInterviewCompleted(ws.interview)) {
      return res.status(403).json({
        error: 'Forbidden: Complete the required AI interview before unlocking career roadmaps.',
      });
    }

    const { careerId, profile, advancedUnlocked } = req.body as {
      careerId: string;
      profile: StudentProfile;
      advancedUnlocked?: boolean;
    };

    const liveCareers = await listManagedCareers(false);
    const activeCatalog = liveCareers.length > 0 ? liveCareers : CAREER_CATALOG;
    const career = activeCatalog.find((c) => c.id === careerId) || activeCatalog[0];
    const baseRoadmap: RoadmapStage[] = buildDefaultRoadmapForCareer(career, Boolean(advancedUnlocked));

    const roadmapCacheKey = `roadmap:${career.id}:${profile.educationStage}:${profile.academicStream}:${Boolean(advancedUnlocked)}`;
    const cachedRoadmap = getCachedValue<RoadmapStage[]>(roadmapCacheKey);
    if (cachedRoadmap) {
      return res.json({ roadmap: cachedRoadmap });
    }

    const ai = getGeminiClient();
    if (ai) {
      try {
        const parsed = await dedupeAsync(roadmapCacheKey, async () => {
          const prompt = `
Personalize the 6-level career roadmap subtitles and first milestone details for student ${profile.fullName} (currently in ${profile.educationStage}, stream: ${profile.academicStream}) pursuing "${career.title}".
Keep it concise, practical, and accurate to real academic progression across:
Level 1 (After 12th), Level 2 (Entrance Examinations), Level 3 (College Journey), Level 4 (Skills and Experience), Level 5 (Job Opportunities), Level 6 (Future Scope).
Return JSON with an array "stageCustomizations" of 6 objects: { stageNumber, customSubtitle, personalizedTip }.`;

          const { response } = await generateContentWithRateLimitHandling(
            ai,
            {
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    stageCustomizations: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          stageNumber: { type: Type.INTEGER },
                          customSubtitle: { type: Type.STRING },
                          personalizedTip: { type: Type.STRING },
                        },
                      },
                    },
                  },
                },
              },
            },
            { lowThinking: true }
          );
          return JSON.parse((response.text ?? '{}').trim());
        });

        const customMap = new Map<number, { customSubtitle: string; personalizedTip: string }>();
        for (const item of parsed.stageCustomizations || []) {
          customMap.set(item.stageNumber, item);
        }
        baseRoadmap.forEach((stage) => {
          const custom = customMap.get(stage.stageNumber);
          if (custom?.customSubtitle) {
            stage.subtitle = custom.customSubtitle;
          }
          if (custom?.personalizedTip && stage.missions[0]) {
            stage.missions[0].scenarioContext = `${stage.missions[0].scenarioContext} Personalized tip: ${custom.personalizedTip}`;
          }
        });
      } catch (err) {
        console.error('Gemini roadmap customization fallback:', parseGeminiApiError(err).userMessage);
      }
    }

    // All 6 levels remain freely navigable per student-choice guidelines
    baseRoadmap.forEach((stage) => {
      stage.unlocked = true;
    });

    setCachedValue(roadmapCacheKey, baseRoadmap, 15 * 60 * 1000);
    return res.json({ roadmap: baseRoadmap });
  });

  // --- MISSION EVALUATION & HINTS ROUTE ---
  app.post('/api/ai/evaluate-mission', requireAuth, async (req: AuthRequest, res) => {
    const { careerId, mission, selectedOptionIndex, writtenResponse } = req.body as {
      careerId: string;
      mission: RoadmapStage['missions'][number];
      selectedOptionIndex: number | null;
      writtenResponse: string;
    };

    const liveCareers = await listManagedCareers(false);
    const activeCatalog = liveCareers.length > 0 ? liveCareers : CAREER_CATALOG;
    const career = activeCatalog.find((c) => c.id === careerId) || activeCatalog[0];
    const trimmed = (writtenResponse || '').trim();
    const mcPassed =
      !mission.multipleChoiceQuestion ||
      selectedOptionIndex === mission.multipleChoiceQuestion.correctIndex;

    const ai = getGeminiClient();
    if (ai && trimmed.length >= 12) {
      try {
        const prompt = `
Evaluate a student's interactive mission submission in our Career Simulation World.
Career: ${career.title}
Mission: ${mission.title}
Scenario: ${mission.scenarioContext}
Prompt: ${mission.taskPrompt}
Evaluation Criteria: ${mission.evaluationCriteria.join('; ')}
Multiple Choice Correct: ${mcPassed ? 'Yes' : 'No'}
Student Written Response: "${trimmed}"

Score fairly (0 to 100). A submission passes (passed: true) if Multiple Choice is correct (when present) AND the written response meaningfully addresses at least 2 criteria with >= 65 score. If it is too vague, off-topic, or fails the multiple choice question, set passed: false and give specific constructive hints and learningSupport so the student can improve and retry.
Return valid JSON.`;

        const { response } = await generateContentWithRateLimitHandling(
          ai,
          {
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  passed: { type: Type.BOOLEAN },
                  score: { type: Type.INTEGER },
                  feedback: { type: Type.STRING },
                  hints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  learningSupport: { type: Type.STRING },
                },
                required: ['passed', 'score', 'feedback', 'hints', 'learningSupport'],
              },
            },
          },
          { lowThinking: true }
        );

        const parsed = JSON.parse((response.text ?? '{}').trim());
        const passed = Boolean(parsed.passed) && mcPassed && (parsed.score ?? 0) >= 65;
        return res.json({
          missionId: mission.id,
          passed,
          score: parsed.score ?? (passed ? 82 : 52),
          feedback: parsed.feedback,
          hints: passed ? [] : parsed.hints?.length ? parsed.hints : mission.hints,
          learningSupport: parsed.learningSupport || mission.learningSupport,
          skillDeltas: passed ? mission.skillRewards : { 'Analytical Reasoning': 1 },
          jobOfferOutcome: mission.isJobOfferGate ? passed : undefined,
          evaluatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Gemini mission evaluation fallback:', parseGeminiApiError(err).userMessage);
      }
    }

    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    const passed = mcPassed && wordCount >= 10;
    const score = passed ? Math.min(95, 72 + Math.min(20, wordCount)) : mcPassed ? 54 : 42;

    return res.json({
      missionId: mission.id,
      passed,
      score,
      feedback: passed
        ? `Strong submission! You satisfied the ${mission.title} criteria with clear reasoning and practical awareness for ${career.title}.`
        : !mcPassed
          ? `Your multiple-choice decision does not align with best practices for this stage. Review the hints below and adjust both your choice and written plan.`
          : `Your written response is too brief (${wordCount} words). Expand your plan with concrete steps, trade-offs, and a measurable verification metric so the AI mentor can approve completion.`,
      hints: passed ? [] : mission.hints,
      learningSupport: mission.learningSupport,
      skillDeltas: passed ? mission.skillRewards : { 'Analytical Reasoning': 1 },
      jobOfferOutcome: mission.isJobOfferGate ? passed : undefined,
      evaluatedAt: new Date().toISOString(),
    });
  });

  // --- AI CAREER MENTOR TEXT ROUTE ---
  app.post('/api/ai/mentor', requireAuth, async (req: AuthRequest, res) => {
    const { careerId, buildingName, activeMissionTitle, question, skills } = req.body as {
      careerId: string;
      buildingName: string;
      activeMissionTitle?: string;
      question: string;
      skills: Record<string, number>;
    };

    const liveCareers = await listManagedCareers(false);
    const activeCatalog = liveCareers.length > 0 ? liveCareers : CAREER_CATALOG;
    const career = activeCatalog.find((c) => c.id === careerId) || activeCatalog[0];
    const ai = getGeminiClient();
    if (ai) {
      try {
        const prompt = `
You are the AI Career Mentor stationed inside the 3D Career World at "${buildingName}" for the career "${career.title}".
Active mission: ${activeMissionTitle || 'Exploring campus locations'}
Student current skill levels: ${JSON.stringify(skills)}
Student asks: "${question}"

Give a practical, encouraging, domain-accurate response in 3-5 sentences.`;

        const { response } = await generateContentWithRateLimitHandling(
          ai,
          { contents: prompt },
          { lowThinking: true }
        );
        return res.json({ reply: (response.text ?? '').trim() });
      } catch (err) {
        console.error('Gemini mentor fallback:', parseGeminiApiError(err).userMessage);
      }
    }

    return res.json({
      reply: `Welcome to ${buildingName}! For ${career.title}, focus right now on ${activeMissionTitle || 'building verifiable portfolio artifacts'}. Notice that your strongest foundation helps you tackle ${career.entranceExams[0]} and real workplace tasks like ${career.dailySimulationContext}. Click the active mission prompt in this pavilion whenever you are ready to practice!`,
    });
  });

  // --- AI PROGRESS & SKILL GAP ANALYSIS ---
  app.post('/api/ai/analyze-progress', requireAuth, async (req: AuthRequest, res) => {
    const { careerId, skills, completedMissionIds, roadmap } = req.body as {
      careerId: string;
      skills: Record<string, number>;
      completedMissionIds: string[];
      roadmap: RoadmapStage[];
    };

    const liveCareers = await listManagedCareers(false);
    const activeCatalog = liveCareers.length > 0 ? liveCareers : CAREER_CATALOG;
    const career = activeCatalog.find((c) => c.id === careerId) || activeCatalog[0];
    const requirementComparison = Object.entries(career.requiredSkills).map(([skill, required]) => ({
      skill,
      current: skills[skill] ?? 50,
      required,
    }));

    const strengths = requirementComparison
      .filter((r) => r.current >= r.required - 8)
      .map((r) => `${r.skill} (${r.current}/${r.required})`);
    const skillGaps = requirementComparison
      .filter((r) => r.current < r.required - 8)
      .map((r) => `${r.skill}: needs +${r.required - r.current} pts`);

    const totalMissions = roadmap.reduce((acc, s) => acc + s.missions.length, 0) || 5;
    const avgRatio =
      requirementComparison.reduce((acc, r) => acc + Math.min(1, r.current / r.required), 0) /
      requirementComparison.length;
    const careerReadinessScore = Math.round(avgRatio * 100);

    let summary = `You have completed ${completedMissionIds.length} of ${totalMissions} career missions in ${career.title}, reaching ${careerReadinessScore}% requirement alignment.`;
    let satisfactionRecommendation =
      skillGaps.length === 0
        ? 'Your skills match or exceed target benchmarks. If you enjoy this path, unlock Advanced Principal Missions!'
        : `Focus your next missions on ${skillGaps[0]}—or if this work feels misaligned with your interests, compare alternative pathways below.`;

    const ai = getGeminiClient();
    if (ai) {
      try {
        const prompt = `
Analyze a student's progress against career requirements for "${career.title}".
Skill comparison: ${JSON.stringify(requirementComparison)}
Missions completed: ${completedMissionIds.length} / ${totalMissions}
Provide a 2-sentence analytical summary of strengths and skill gaps, and a 1-sentence recommendation for whether to advance or explore alternatives. Return JSON { summary, satisfactionRecommendation }.`;

        const { response } = await generateContentWithRateLimitHandling(
          ai,
          {
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  satisfactionRecommendation: { type: Type.STRING },
                },
              },
            },
          },
          { lowThinking: true }
        );
        const parsed = JSON.parse((response.text ?? '{}').trim());
        if (parsed.summary) summary = parsed.summary;
        if (parsed.satisfactionRecommendation) satisfactionRecommendation = parsed.satisfactionRecommendation;
      } catch (err) {
        console.error('Gemini analyze-progress fallback:', parseGeminiApiError(err).userMessage);
      }
    }

    const analytics: ProgressAnalytics = {
      strengths: strengths.length ? strengths : ['Early Curiosity & Initiative'],
      skillGaps,
      careerReadinessScore,
      requirementComparison,
      summary,
      satisfactionRecommendation,
    };

    return res.json({ analytics });
  });

  // --- TEXT-TO-VIDEO GENERATION VIA INTERACTIONS API (gemini-omni-1.2-flash) ---
  app.get('/api/videos', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser!;
      const videos = await listCareerVideosForUser(dbUser.id);
      res.json({ videos });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch videos';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/generate-video', requireAuth, async (req: AuthRequest, res) => {
    const dbUser = req.dbUser!;
    const { careerId, prompt, aspectRatio, previousInteractionId, imageBase64, imageMimeType } = req.body as {
      careerId: string;
      prompt: string;
      aspectRatio: '16:9' | '9:16';
      previousInteractionId?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'A video prompt is required.' });
    }

    const safeRatio: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured. Please check Settings > Secrets.',
      });
    }

    const cleanImageBase64 = imageBase64
      ? imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim()
      : '';
    const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    const safeMimeType = imageMimeType && allowedMimes.has(imageMimeType) ? imageMimeType : 'image/png';

    const interactionInput =
      cleanImageBase64 && !previousInteractionId
        ? [
            {
              type: 'image' as const,
              mime_type: safeMimeType,
              data: cleanImageBase64,
            },
            {
              type: 'text' as const,
              text: prompt.trim(),
            },
          ]
        : prompt.trim();

    try {
      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: interactionInput,
          ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
          background: false,
          store: true,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: safeRatio,
            duration: '6s',
            resolution: '720p',
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (!videoPart || (!videoPart.data && !videoPart.uri)) {
        return res.status(502).json({
          error: 'Video generation completed without returning video data.',
        });
      }

      let base64Data = videoPart.data || '';
      const mimeType = videoPart.mime_type || 'video/mp4';

      if (!base64Data && videoPart.uri) {
        const fetched = await fetch(videoPart.uri);
        const arrBuf = await fetched.arrayBuffer();
        base64Data = Buffer.from(arrBuf).toString('base64');
      }

      const saved = await saveCareerVideo({
        userId: dbUser.id,
        careerId: careerId || 'general',
        prompt: prompt.trim(),
        aspectRatio: safeRatio,
        interactionId: interaction.id || null,
        mimeType,
        videoDataBase64: base64Data,
      });

      return res.json({
        video: {
          ...saved,
          videoDataBase64: base64Data,
        },
      });
    } catch (error: unknown) {
      const parsedErr = parseGeminiApiError(error);
      console.error('Gemini Interactions video generation error:', parsedErr.rawMessage);
      return res.status(parsedErr.status).json({
        error: parsedErr.isRateLimit
          ? 'Custom MP4 video rendering (gemini-omni-1.2-flash) is rate-limited or unavailable on the Free Tier. Use the Animated Career Journey player above for free-tier HTML/CSS/JS animated career videos.'
          : parsedErr.userMessage,
        code: parsedErr.code,
        retryAfterSeconds: parsedErr.retryAfterSeconds,
      });
    }
  });

  // --- EXPLORE CAREERS CONVERSATIONAL AI MENTOR ---
  app.post('/api/ai/explore-mentor', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { question, profile, comparedCareerIds, focusedCareerId } = req.body as {
        question: string;
        profile?: StudentProfile | null;
        comparedCareerIds?: string[];
        focusedCareerId?: string | null;
      };
      const cleanQ = (question || '').trim();
      if (!cleanQ) {
        return res.status(400).json({ error: 'Please enter a career question for your AI mentor.' });
      }

      const liveCareers = await listManagedCareers(false);
      const activeCatalog = liveCareers.length > 0 ? liveCareers : CAREER_CATALOG;
      const focusedCareer = focusedCareerId
        ? activeCatalog.find((c) => c.id === focusedCareerId) || null
        : null;
      const comparedCareers = (comparedCareerIds || [])
        .map((id) => activeCatalog.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

      const ai = getGeminiClient();
      if (ai) {
        try {
          const prompt = `
You are VECTORA's friendly, accurate AI Career Mentor helping a student inside the Explore Careers page.
Student Profile: ${profile ? `${profile.fullName}, Stage: ${profile.educationStage}, Stream: ${profile.academicStream}, Subjects: ${profile.topSubjects.join(', ')}` : 'High school / college student'}
${focusedCareer ? `Currently Focused Career: ${focusedCareer.title} (${focusedCareer.domain}) — Exams: ${focusedCareer.entranceExams.join(', ')}, Courses: ${focusedCareer.recommendedCourses.join(', ')}, Salary: ${focusedCareer.salaryBand}, Outlook: ${focusedCareer.growthOutlook}` : ''}
${comparedCareers.length > 0 ? `Compared Careers: ${comparedCareers.map((c) => `${c.title} (Exams: ${c.entranceExams.join(', ')}, Salary: ${c.salaryBand}, Growth: ${c.growthOutlook})`).join(' | ')}` : ''}

Available VECTORA Catalog Summary:
${activeCatalog.map((c) => `- ${c.title} (${c.domain}): ${c.eligibility12th} | Exams: ${c.entranceExams[0]} | Outlook: ${c.growthOutlook}`).join('\n')}

Student Question: "${cleanQ}"

Answer clearly, practically, and encouragingly in 3-5 concise sentences covering exact entrance exams, years of study, skills needed, or future trends as asked.`;

          const { response } = await generateContentWithRateLimitHandling(
            ai,
            { contents: prompt },
            { lowThinking: true }
          );
          const replyText = (response.text ?? '').trim();
          if (replyText) {
            return res.json({ reply: replyText });
          }
        } catch (err) {
          console.error('Gemini explore-mentor fallback triggered:', parseGeminiApiError(err).userMessage);
        }
      }

      const target = focusedCareer || comparedCareers[0] || activeCatalog[0];
      return res.json({
        reply: `Great question! Looking at ${target.title} (${target.domain}), entry after 12th requires ${target.eligibility12th}. Key qualifying exams include ${target.entranceExams.join(', ')}, leading into ${target.recommendedCourses[0]} (typically 3–4 years of study) and roles such as ${target.workplaceRoles.join(', ')} with ${target.growthOutlook}. Select any career card to generate your 6-level roadmap and animated step-by-step video journey!`,
      });
    } catch (error: unknown) {
      const parsedErr = parseGeminiApiError(error);
      return res.status(parsedErr.status).json({
        error: parsedErr.userMessage,
        code: parsedErr.code,
        retryAfterSeconds: parsedErr.retryAfterSeconds,
      });
    }
  });

  // Helper to decode cached AnimatedSceneScript stored in career_videos
  const parseStoredSceneScript = (mimeType: string, base64: string): AnimatedSceneScript | null => {
    if (mimeType !== SCENE_SCRIPT_MIME_TYPE || !base64) return null;
    try {
      const raw = Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(raw) as AnimatedSceneScript;
    } catch {
      return null;
    }
  };

  // --- AUTOMATED ANIMATED CAREER JOURNEY SESSION PLANNER (12th Pass -> Exams -> College Years -> Job -> Future Scope) ---
  app.post('/api/ai/career-journey-plan', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = req.dbUser!;
      const ws = await getWorkspaceForUser(dbUser.id, dbUser.email, dbUser.fullName);
      if (dbUser.role === 'student' && !isInterviewCompleted(ws.interview)) {
        return res.status(403).json({
          error: 'Forbidden: Complete the required AI interview before generating career journey videos.',
        });
      }

      const { careerId, profile } = req.body as {
        careerId: string;
        profile?: StudentProfile | null;
      };
      const liveCareers = await listManagedCareers(false);
      const activeCatalog = liveCareers.length > 0 ? liveCareers : CAREER_CATALOG;
      const career = activeCatalog.find((c) => c.id === careerId) || activeCatalog[0];

      const templates = buildCareerVideoSessionTemplates(career);
      const cachedSessions = await listCachedCareerVideoSessions(career.id);
      const cachedByKey = new Map(cachedSessions.map((c) => [c.sessionKey || '', c]));

      const studentStage = profile?.educationStage || '12th Standard';
      const studentStream = profile?.academicStream || 'General';
      const planCacheKey = `journey-plan:${career.id}:${studentStage}:${studentStream}`;

      let customizedMap = getCachedValue<
        Map<string, { narrationScript?: string; animationPrompt?: string; keyTakeaways?: string[] }>
      >(planCacheKey);

      if (!customizedMap) {
        customizedMap = new Map();
        const ai = getGeminiClient();

        // Only call Gemini if all 7 sessions aren't already cached in PostgreSQL
        if (ai && cachedByKey.size < templates.length) {
          try {
            const parsed = await dedupeAsync(planCacheKey, async () => {
              const prompt = `
Customize these 7 career-journey animated video session scripts for a student (${studentStage}, stream: ${studentStream}) who just selected "${career.title}" (${career.domain}).
Keep each narrationScript warm, motivating, crystal clear, and 35-55 words covering exact exams (${career.entranceExams.join(', ')}), degrees (${career.recommendedCourses.join(', ')}), studying years, and daily job reality (${career.dailySimulationContext}).
Sessions:
${templates.map((t) => `- ${t.sessionKey}: ${t.title} (${t.subtitle})`).join('\n')}
Return strict JSON { sessions: [{ sessionKey, narrationScript, animationPrompt, keyTakeaways }] }.`;

              const { response } = await generateContentWithRateLimitHandling(
                ai,
                {
                  contents: prompt,
                  config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                        sessions: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              sessionKey: { type: Type.STRING },
                              narrationScript: { type: Type.STRING },
                              animationPrompt: { type: Type.STRING },
                              keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
                            },
                            required: ['sessionKey', 'narrationScript', 'animationPrompt', 'keyTakeaways'],
                          },
                        },
                      },
                      required: ['sessions'],
                    },
                  },
                },
                { lowThinking: true }
              );
              return JSON.parse((response.text ?? '{}').trim()) as {
                sessions?: {
                  sessionKey: string;
                  narrationScript?: string;
                  animationPrompt?: string;
                  keyTakeaways?: string[];
                }[];
              };
            });

            for (const item of parsed.sessions || []) {
              customizedMap.set(item.sessionKey, item);
            }
            if (customizedMap.size > 0) {
              setCachedValue(planCacheKey, customizedMap, 20 * 60 * 1000);
            }
          } catch (err) {
            console.error(
              'Gemini career-journey-plan customization fallback:',
              parseGeminiApiError(err).userMessage
            );
          }
        }
      }

      const sessions: CareerVideoSessionPlan[] = templates.map((tpl) => {
        const custom = customizedMap?.get(tpl.sessionKey);
        const cached = cachedByKey.get(tpl.sessionKey);
        const narrationScript =
          cached?.narrationScript || custom?.narrationScript || tpl.narrationScript;
        const animationPrompt = custom?.animationPrompt || tpl.animationPrompt;
        const keyTakeaways =
          custom?.keyTakeaways && custom.keyTakeaways.length > 0
            ? custom.keyTakeaways
            : tpl.keyTakeaways;
        const subtitles =
          cached?.subtitles && Array.isArray(cached.subtitles) && cached.subtitles.length > 0
            ? cached.subtitles
            : tpl.subtitles;
        const checkpoint = cached?.checkpoint || tpl.checkpoint;
        const parsedScene = cached
          ? parseStoredSceneScript(cached.mimeType, cached.videoDataBase64)
          : null;

        return {
          sessionKey: tpl.sessionKey,
          levelNumber: tpl.levelNumber,
          stageLabel: tpl.stageLabel,
          title: tpl.title,
          subtitle: tpl.subtitle,
          animationPrompt,
          narrationScript,
          keyTakeaways,
          subtitles,
          checkpoint,
          video: cached
            ? {
                id: cached.id,
                careerId: cached.careerId,
                sessionKey: cached.sessionKey || tpl.sessionKey,
                levelNumber: cached.levelNumber ?? tpl.levelNumber,
                sessionTitle: cached.sessionTitle || tpl.title,
                prompt: cached.prompt,
                aspectRatio: cached.aspectRatio === '9:16' ? '9:16' : '16:9',
                interactionId: cached.interactionId,
                mimeType: cached.mimeType,
                videoDataBase64: cached.videoDataBase64,
                sceneScript: parsedScene,
                modelUsed: parsedScene?.modelUsed || null,
                narrationScript: cached.narrationScript,
                subtitles: cached.subtitles || tpl.subtitles,
                checkpoint: cached.checkpoint || tpl.checkpoint,
                audioBase64: cached.audioBase64,
                createdAt:
                  cached.createdAt instanceof Date
                    ? cached.createdAt.toISOString()
                    : String(cached.createdAt),
              }
            : null,
        };
      });

      return res.json({ career, sessions });
    } catch (error: unknown) {
      const parsedErr = parseGeminiApiError(error);
      return res.status(parsedErr.status).json({
        error: parsedErr.userMessage,
        code: parsedErr.code,
        retryAfterSeconds: parsedErr.retryAfterSeconds,
      });
    }
  });

  // --- GENERATE OR FETCH CACHED HTML/CSS/JS ANIMATED SCENE SCRIPT + OPTIONAL FREE-TIER TTS ---
  app.post('/api/ai/career-journey-video', requireAuth, async (req: AuthRequest, res) => {
    const dbUser = req.dbUser!;
    const ws = await getWorkspaceForUser(dbUser.id, dbUser.email, dbUser.fullName);
    if (dbUser.role === 'student' && !isInterviewCompleted(ws.interview)) {
      return res.status(403).json({
        error: 'Forbidden: Complete the AI interview before generating career videos.',
      });
    }

    const {
      careerId,
      sessionKey,
      levelNumber,
      sessionTitle,
      animationPrompt,
      narrationScript,
      subtitles,
      checkpoint,
      forceRegenerate,
    } = req.body as {
      careerId: string;
      sessionKey: string;
      levelNumber: number;
      sessionTitle: string;
      animationPrompt: string;
      narrationScript: string;
      subtitles?: CareerVideoSubtitleCue[];
      checkpoint?: CareerVideoCheckpoint | null;
      forceRegenerate?: boolean;
    };

    if (!careerId || !sessionKey || !animationPrompt?.trim()) {
      return res.status(400).json({ error: 'careerId, sessionKey, and animationPrompt are required.' });
    }

    if (!forceRegenerate) {
      const existing = await findCachedCareerVideoSession(careerId, sessionKey);
      if (existing && existing.videoDataBase64) {
        const parsedScene = parseStoredSceneScript(existing.mimeType, existing.videoDataBase64);
        return res.json({
          cached: true,
          video: {
            id: existing.id,
            careerId: existing.careerId,
            sessionKey: existing.sessionKey || sessionKey,
            levelNumber: existing.levelNumber ?? levelNumber,
            sessionTitle: existing.sessionTitle || sessionTitle,
            prompt: existing.prompt,
            aspectRatio: existing.aspectRatio === '9:16' ? '9:16' : '16:9',
            interactionId: existing.interactionId,
            mimeType: existing.mimeType,
            videoDataBase64: existing.videoDataBase64,
            sceneScript: parsedScene,
            modelUsed: parsedScene?.modelUsed || null,
            narrationScript: existing.narrationScript || narrationScript,
            subtitles: existing.subtitles || subtitles || [],
            checkpoint: existing.checkpoint || checkpoint || null,
            audioBase64: existing.audioBase64 || null,
            createdAt:
              existing.createdAt instanceof Date
                ? existing.createdAt.toISOString()
                : String(existing.createdAt),
          },
        });
      }
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured. Please verify your key in Settings > Secrets.',
      });
    }

    const liveCareers = await listManagedCareers(false);
    const activeCatalog = liveCareers.length > 0 ? liveCareers : CAREER_CATALOG;
    const career = activeCatalog.find((c) => c.id === careerId) || activeCatalog[0];

    const dedupeKey = `scene-gen:${careerId}:${sessionKey}:${forceRegenerate ? Date.now() : 'cached'}`;

    try {
      const result = await dedupeAsync(dedupeKey, async () => {
        const defaultMetaphor =
          sessionKey === 'after-12th'
            ? 'gateway'
            : sessionKey === 'entrance-exams'
              ? 'exams'
              : sessionKey === 'college-years'
                ? 'campus'
                : sessionKey === 'skills-internships'
                  ? 'workshop'
                  : sessionKey === 'daily-job'
                    ? 'office'
                    : sessionKey === 'future-scope'
                      ? 'horizon'
                      : 'orbit';

        const prompt = `
Create a rich 4-scene animated educational storyboard script for VECTORA's HTML/CSS/JavaScript motion player.
Career: ${career.title} (${career.domain})
Session: ${sessionTitle} (sessionKey=${sessionKey}, level=${levelNumber})
Visual Concept: ${animationPrompt.trim()}
Career Facts:
- 12th Eligibility: ${career.eligibility12th}
- Qualifying Exams: ${career.entranceExams.join(', ')}
- Degree Courses: ${career.recommendedCourses.join(', ')}
- Workplace Roles: ${career.workplaceRoles.join(', ')}
- Daily Simulation: ${career.dailySimulationContext}
- Salary & Growth: ${career.salaryBand} | ${career.growthOutlook}

Generate:
1. "narrationScript": a warm, engaging 45-65 word educational voiceover script tailored to this session.
2. "scenes": exactly 4 sequential animated scenes (each 5 seconds, total 20s) progressing clearly through this stage. Each scene has:
   - "id": "scene-1" .. "scene-4"
   - "title": short 3-6 word scene heading
   - "badge": concise 2-3 word label (e.g., "After 12th", "Exam Sprint", "Year 2 Lab", "Daily Workflow")
   - "headline": crisp 6-12 word key message shown on screen
   - "visualMetaphor": one of ["gateway", "exams", "campus", "workshop", "office", "horizon", "orbit"] (prefer "${defaultMetaphor}" for opening scene and relevant stage metaphors)
   - "keyPoints": 2 short animated bullet callouts (under 10 words each)
   - "statLabel": concise metric title (e.g., "Target Exams", "Study Span", "Entry Band")
   - "statValue": concise metric value (e.g., "${career.entranceExams[0] || 'Core Test'}")
   - "motionCue": brief animation choreography note (e.g., "Pulse gateway nodes & rise timeline")
   - "durationSec": 5
3. "subtitles": 4 synchronized caption cues covering seconds 0-5, 5-10, 10-15, and 15-20 matching the narration.

Return strict JSON matching the schema.`;

        const { response, modelUsed } = await generateContentWithRateLimitHandling(
          ai,
          {
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  narrationScript: { type: Type.STRING },
                  scenes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        badge: { type: Type.STRING },
                        headline: { type: Type.STRING },
                        visualMetaphor: { type: Type.STRING },
                        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                        statLabel: { type: Type.STRING },
                        statValue: { type: Type.STRING },
                        motionCue: { type: Type.STRING },
                        durationSec: { type: Type.INTEGER },
                      },
                      required: [
                        'id',
                        'title',
                        'badge',
                        'headline',
                        'visualMetaphor',
                        'keyPoints',
                        'statLabel',
                        'statValue',
                        'motionCue',
                        'durationSec',
                      ],
                    },
                  },
                  subtitles: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        startSec: { type: Type.INTEGER },
                        endSec: { type: Type.INTEGER },
                        text: { type: Type.STRING },
                      },
                      required: ['startSec', 'endSec', 'text'],
                    },
                  },
                },
                required: ['narrationScript', 'scenes', 'subtitles'],
              },
            },
          },
          { lowThinking: true }
        );

        const parsed = JSON.parse((response.text ?? '{}').trim()) as {
          narrationScript?: string;
          scenes?: AnimatedSceneScript['scenes'];
          subtitles?: CareerVideoSubtitleCue[];
        };

        if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
          throw new Error('Gemini returned an empty scene script.');
        }

        const validMetaphors = new Set([
          'gateway',
          'exams',
          'campus',
          'workshop',
          'office',
          'horizon',
          'orbit',
        ]);
        const normalizedScenes = parsed.scenes.slice(0, 4).map((sc, idx) => ({
          id: sc.id || `scene-${idx + 1}`,
          title: sc.title || `${sessionTitle} · Part ${idx + 1}`,
          badge: sc.badge || `Step 0${idx + 1}`,
          headline: sc.headline || sessionTitle,
          visualMetaphor: validMetaphors.has(sc.visualMetaphor)
            ? sc.visualMetaphor
            : (defaultMetaphor as AnimatedSceneScript['scenes'][number]['visualMetaphor']),
          keyPoints: Array.isArray(sc.keyPoints) ? sc.keyPoints.slice(0, 3) : [],
          statLabel: sc.statLabel || career.domain,
          statValue: sc.statValue || career.entranceExams[0] || career.title,
          motionCue: sc.motionCue || 'Smooth orbital transition',
          durationSec: Math.max(4, Math.min(8, Number(sc.durationSec) || 5)),
        }));

        const totalDurationSec = normalizedScenes.reduce((sum, s) => sum + s.durationSec, 0);
        const sceneScript: AnimatedSceneScript = {
          version: 1,
          careerTitle: career.title,
          sessionTitle: sessionTitle || sessionKey,
          totalDurationSec,
          modelUsed,
          theme: {
            primaryColor: '#6A5ACD',
            accentColor: '#F4A62A',
            backdropStyle: 'vectra-cosmos',
          },
          scenes: normalizedScenes,
        };

        const finalNarration = (parsed.narrationScript || narrationScript || '').trim();
        const finalSubtitles =
          Array.isArray(parsed.subtitles) && parsed.subtitles.length > 0
            ? parsed.subtitles
            : subtitles || [];

        // Optional Free-Tier TTS voiceover (never fails the animated scene if TTS quota is busy)
        let audioBase64: string | null = null;
        if (finalNarration) {
          try {
            const ttsResponse = await ai.models.generateContent({
              model: FREE_TTS_MODEL,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: finalNarration,
                      speechMetadata: { style: 'Warm, clear, encouraging career mentor' },
                    } as never,
                  ],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                  },
                },
              },
            });
            const audioInline = ttsResponse?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
            if (audioInline?.data) {
              audioBase64 = audioInline.data;
            }
          } catch (ttsErr) {
            console.warn(
              'Gemini TTS narration unavailable (client speech fallback ready):',
              parseGeminiApiError(ttsErr).userMessage
            );
          }
        }

        const scriptBase64 = Buffer.from(JSON.stringify(sceneScript), 'utf8').toString('base64');

        const saved = await saveCareerVideoSession({
          userId: dbUser.id,
          careerId,
          sessionKey,
          levelNumber: Number(levelNumber) || 1,
          sessionTitle: sessionTitle || sessionKey,
          prompt: animationPrompt.trim(),
          aspectRatio: '16:9',
          interactionId: null,
          mimeType: SCENE_SCRIPT_MIME_TYPE,
          videoDataBase64: scriptBase64,
          narrationScript: finalNarration,
          subtitles: finalSubtitles,
          checkpoint: checkpoint || null,
          audioBase64,
        });

        return {
          cached: false,
          video: {
            ...saved,
            sceneScript,
            modelUsed,
            createdAt:
              saved.createdAt instanceof Date ? saved.createdAt.toISOString() : String(saved.createdAt),
          },
        };
      });

      return res.json(result);
    } catch (error: unknown) {
      const parsedErr = parseGeminiApiError(error);
      console.error('Gemini Career Journey Scene Script error:', parsedErr.rawMessage);
      return res.status(parsedErr.status).json({
        error: parsedErr.userMessage,
        code: parsedErr.code,
        retryAfterSeconds: parsedErr.retryAfterSeconds,
      });
    }
  });

  // --- SEPARATE ADMIN AUTHENTICATION VERIFICATION (Server-Side Provisioned Only) ---
  app.post('/api/auth/admin-verify', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { passcode } = req.body as { passcode?: string };
      const dbUser = req.dbUser!;
      const result = await verifyAdminPortalLogin(
        dbUser.id,
        dbUser.email,
        dbUser.role,
        dbUser.permissions,
        passcode
      );
      if (!result.granted) {
        return res.status(403).json({ error: result.message });
      }
      res.json({
        user: {
          ...dbUser,
          role: result.role,
          permissions: result.permissions,
        },
        message: result.message,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Admin verification failed.';
      res.status(500).json({ error: msg });
    }
  });

  // --- ADMIN AUTHENTICATION, SECURITY & RBAC CONSOLE ROUTES (100% Protected) ---
  app.get(
    '/api/admin/security-status',
    requireAuth,
    requireAdmin(),
    async (req: AuthRequest, res) => {
      try {
        const status = await getAdminSecurityStatus();
        res.json({
          ...status,
          isAdmin: req.dbUser?.role === 'admin',
          permissions: req.dbUser?.permissions || [],
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to check admin security status.';
        res.status(500).json({ error: msg });
      }
    }
  );

  app.get(
    '/api/admin/invitations',
    requireAuth,
    requireAdmin('manage_security'),
    async (_req: AuthRequest, res) => {
      try {
        const invitations = await listAdminInvitations();
        res.json({ invitations });
      } catch (error: unknown) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to load admin invitations.',
        });
      }
    }
  );

  app.post(
    '/api/admin/invitations',
    requireAuth,
    requireAdmin('manage_security'),
    async (req: AuthRequest, res) => {
      try {
        const { email, permissions } = req.body as {
          email?: string;
          permissions?: AdminPermission[];
        };
        const invitation = await createAdminInvitation(
          email || '',
          req.dbUser!.email,
          Array.isArray(permissions) ? permissions : []
        );
        res.json({ invitation });
      } catch (error: unknown) {
        res.status(400).json({
          error: error instanceof Error ? error.message : 'Failed to create admin invitation.',
        });
      }
    }
  );

  app.delete(
    '/api/admin/invitations/:id',
    requireAuth,
    requireAdmin('manage_security'),
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ error: 'Invalid invitation ID.' });
        }
        await revokeAdminInvitation(id);
        res.json({ ok: true });
      } catch (error: unknown) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to revoke invitation.',
        });
      }
    }
  );

  app.put(
    '/api/admin/account',
    requireAuth,
    requireAdmin('manage_security'),
    async (req: AuthRequest, res) => {
      try {
        const { fullName, avatarUrl, newAdminPasscode } = req.body as {
          fullName?: string;
          avatarUrl?: string;
          newAdminPasscode?: string;
        };
        if (fullName || avatarUrl !== undefined) {
          await db
            .update(users)
            .set({
              ...(fullName?.trim() ? { fullName: fullName.trim() } : {}),
              ...(avatarUrl !== undefined ? { avatarUrl } : {}),
              lastActiveAt: new Date(),
            })
            .where(eq(users.id, req.dbUser!.id));
        }
        if (newAdminPasscode && newAdminPasscode.trim()) {
          await updateAdminPasscodeForUser(newAdminPasscode);
        }
        res.json({ ok: true });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to update admin settings.';
        res.status(400).json({ error: msg });
      }
    }
  );

  // B & J: Overview + Reports & Analytics
  app.get(
    '/api/admin/overview',
    requireAuth,
    requireAdmin('view_analytics'),
    async (_req: AuthRequest, res) => {
      try {
        const overview = await getAdminOverviewAnalytics();
        res.json(overview);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to load admin overview.';
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    '/api/admin/issues',
    requireAuth,
    requireAdmin('view_analytics'),
    async (req: AuthRequest, res) => {
      try {
        const issue = req.body as Omit<AdminSystemIssue, 'id' | 'createdAt'>;
        const cfg = await getPlatformConfigData();
        const nextIssues: AdminSystemIssue[] = [
          {
            id: `issue-${Date.now()}`,
            area: issue.area || 'Platform Content',
            severity: issue.severity || 'medium',
            message: issue.message || 'Review requested.',
            status: 'open',
            createdAt: new Date().toISOString(),
          },
          ...cfg.issues,
        ];
        await updateSystemIssues(nextIssues);
        res.json({ issues: nextIssues });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to log issue.' });
      }
    }
  );

  app.patch(
    '/api/admin/issues/:id',
    requireAuth,
    requireAdmin('view_analytics'),
    async (req: AuthRequest, res) => {
      try {
        const { status } = req.body as { status: 'open' | 'resolved' };
        const cfg = await getPlatformConfigData();
        const nextIssues = cfg.issues.map((i) =>
          i.id === req.params.id ? { ...i, status: status || 'resolved' } : i
        );
        await updateSystemIssues(nextIssues);
        res.json({ issues: nextIssues });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update issue.' });
      }
    }
  );

  // C: Student Management & RBAC Permissions
  app.get(
    '/api/admin/students',
    requireAuth,
    requireAdmin('manage_students'),
    async (_req: AuthRequest, res) => {
      try {
        const students = await listStudentsForAdmin();
        res.json({ students });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list students.' });
      }
    }
  );

  app.patch(
    '/api/admin/students/:id',
    requireAuth,
    requireAdmin('manage_students'),
    async (req: AuthRequest, res) => {
      try {
        const targetId = Number(req.params.id);
        if (!Number.isFinite(targetId)) {
          return res.status(400).json({ error: 'Invalid student ID.' });
        }
        const { status, role, permissions } = req.body as {
          status?: AccountStatus;
          role?: UserRole;
          permissions?: AdminPermission[];
        };
        if (
          (role !== undefined || permissions !== undefined) &&
          !req.dbUser!.permissions.includes('manage_security')
        ) {
          return res.status(403).json({ error: 'Only security admins can modify roles or permissions.' });
        }
        const updated = await updateStudentAccountControl(targetId, { status, role, permissions });
        res.json({ student: updated });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update student.' });
      }
    }
  );

  // D: Career Management
  app.get(
    '/api/admin/careers',
    requireAuth,
    requireAdmin('manage_careers'),
    async (_req: AuthRequest, res) => {
      try {
        const careers = await listManagedCareers(true);
        res.json({ careers });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list careers.' });
      }
    }
  );

  app.post(
    '/api/admin/careers',
    requireAuth,
    requireAdmin('manage_careers'),
    async (req: AuthRequest, res) => {
      try {
        const career = req.body as ManagedCareerRecord;
        if (!career?.title?.trim()) {
          return res.status(400).json({ error: 'Career title is required.' });
        }
        const saved = await upsertManagedCareer(career);
        res.json({ career: saved });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save career.' });
      }
    }
  );

  app.delete(
    '/api/admin/careers/:careerId',
    requireAuth,
    requireAdmin('manage_careers'),
    async (req: AuthRequest, res) => {
      try {
        await deleteManagedCareer(req.params.careerId);
        res.json({ ok: true });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to remove career.' });
      }
    }
  );

  // E & F: AI Interview & AI Recommendation Management
  app.get(
    '/api/admin/ai-config',
    requireAuth,
    requireAdmin('manage_ai'),
    async (_req: AuthRequest, res) => {
      try {
        const cfg = await getPlatformConfigData();
        res.json(cfg);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch AI config.' });
      }
    }
  );

  app.put(
    '/api/admin/interview-config',
    requireAuth,
    requireAdmin('manage_ai'),
    async (req: AuthRequest, res) => {
      try {
        const saved = await updateInterviewSettings(req.body as AdminInterviewSettings);
        res.json({ interviewSettings: saved });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save interview settings.' });
      }
    }
  );

  app.put(
    '/api/admin/recommendation-config',
    requireAuth,
    requireAdmin('manage_ai'),
    async (req: AuthRequest, res) => {
      try {
        const saved = await updateRecommendationSettings(req.body as AdminRecommendationSettings);
        res.json({ recommendationSettings: saved });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save recommendation settings.' });
      }
    }
  );

  // G: 3D World Management
  app.get(
    '/api/admin/environments',
    requireAuth,
    requireAdmin('manage_worlds'),
    async (_req: AuthRequest, res) => {
      try {
        const environments = await listManagedEnvironments();
        res.json({ environments });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch environments.' });
      }
    }
  );

  app.post(
    '/api/admin/environments',
    requireAuth,
    requireAdmin('manage_worlds'),
    async (req: AuthRequest, res) => {
      try {
        const env = req.body as ManagedEnvironmentRecord;
        if (!env?.name?.trim()) {
          return res.status(400).json({ error: 'Environment name is required.' });
        }
        const saved = await upsertManagedEnvironment(env);
        res.json({ environment: saved });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save environment.' });
      }
    }
  );

  app.delete(
    '/api/admin/environments/:buildingId',
    requireAuth,
    requireAdmin('manage_worlds'),
    async (req: AuthRequest, res) => {
      try {
        await deleteManagedEnvironment(req.params.buildingId);
        res.json({ ok: true });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to remove environment.' });
      }
    }
  );

  // H: Mission Management
  app.get(
    '/api/admin/missions',
    requireAuth,
    requireAdmin('manage_missions'),
    async (_req: AuthRequest, res) => {
      try {
        const missions = await listManagedMissions();
        res.json({ missions });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list missions.' });
      }
    }
  );

  app.post(
    '/api/admin/missions',
    requireAuth,
    requireAdmin('manage_missions'),
    async (req: AuthRequest, res) => {
      try {
        const mission = req.body as ManagedMissionRecord;
        if (!mission?.title?.trim()) {
          return res.status(400).json({ error: 'Mission title is required.' });
        }
        const saved = await upsertManagedMission(mission);
        res.json({ mission: saved });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save mission.' });
      }
    }
  );

  app.delete(
    '/api/admin/missions/:missionKey',
    requireAuth,
    requireAdmin('manage_missions'),
    async (req: AuthRequest, res) => {
      try {
        await deleteManagedMission(req.params.missionKey);
        res.json({ ok: true });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete mission.' });
      }
    }
  );

  // I: Roadmap & Education Management
  app.get(
    '/api/admin/roadmaps',
    requireAuth,
    requireAdmin('manage_roadmaps'),
    async (_req: AuthRequest, res) => {
      try {
        const roadmaps = await listManagedRoadmaps();
        res.json({ roadmaps });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list roadmaps.' });
      }
    }
  );

  app.post(
    '/api/admin/roadmaps',
    requireAuth,
    requireAdmin('manage_roadmaps'),
    async (req: AuthRequest, res) => {
      try {
        const roadmap = req.body as ManagedRoadmapRecord;
        if (!roadmap?.title?.trim()) {
          return res.status(400).json({ error: 'Pathway title is required.' });
        }
        const saved = await upsertManagedRoadmap(roadmap);
        res.json({ roadmap: saved });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save roadmap pathway.' });
      }
    }
  );

  app.delete(
    '/api/admin/roadmaps/:pathwayKey',
    requireAuth,
    requireAdmin('manage_roadmaps'),
    async (req: AuthRequest, res) => {
      try {
        await deleteManagedRoadmap(req.params.pathwayKey);
        res.json({ ok: true });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to remove pathway.' });
      }
    }
  );

  // --- REAL-TIME VOICE CONVERSATION WEBSOCKET BRIDGE (gemini-3.8-live) ---
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', async (clientWs: WebSocket, req) => {
    const reqUrl = new URL(req.url || '/live', `http://${req.headers.host || 'localhost'}`);
    const token = reqUrl.searchParams.get('token');
    const contextMode = reqUrl.searchParams.get('context') || 'Career Mentor';
    const careerTitle = reqUrl.searchParams.get('career') || 'Career Exploration';
    const liveMode = reqUrl.searchParams.get('mode') || 'mentor';
    const studentName = reqUrl.searchParams.get('studentName') || 'Student';
    const stage = reqUrl.searchParams.get('stage') || '';
    const stream = reqUrl.searchParams.get('stream') || '';
    const subjects = reqUrl.searchParams.get('subjects') || '';
    const curiosities = reqUrl.searchParams.get('curiosities') || '';

    if (!token) {
      clientWs.send(JSON.stringify({ error: 'Unauthorized: missing authentication token.' }));
      clientWs.close();
      return;
    }

    try {
      const decoded = await adminAuth.verifyIdToken(token);
      await getOrCreateUser(decoded.uid, decoded.email || `${decoded.uid}@user.local`, decoded.name);
    } catch {
      clientWs.send(JSON.stringify({ error: 'Unauthorized: invalid Firebase ID token.' }));
      clientWs.close();
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server.' }));
      clientWs.close();
      return;
    }

    const systemInstruction =
      liveMode === 'video_interview'
        ? `You are VECTORA, a warm, supportive human-style AI Career Guidance Assistant speaking with ${studentName} on a 1-on-1 career discovery video call.
Student baseline: Stage=${stage}, Stream=${stream}, Top Subjects=${subjects}, Curiosities=${curiosities || 'exploring'}.

Conduct this session naturally and ethically:
1. Begin immediately with this exact welcoming spirit: "Hello! Welcome to VECTORA. I'm your personal career guidance assistant. Don't worry, this isn't an examination, and there are no right or wrong answers. I am here to understand your interests, strengths, and the kind of future you imagine for yourself. Let's have a friendly conversation. Are you ready to begin?" and ask the first question gently.
2. Guide the student through 10 friendly career-discovery topics ONE question at a time (hobbies/interests, favourite subjects, enjoyed activities, preferred work environment, tech/healthcare/business/creative/education interest, problem-solving style, personal strengths, challenging activities, future lifestyle, and long-term aspirations) plus adaptive follow-ups. Keep turns concise (2-3 spoken sentences), zero markdown.
3. If the student seems unsure or asks to explain differently, say: "That's completely fine. Take your time. Would you like me to explain the question differently?" If they skip/pass a question, say: "No problem. We can move to another question and come back to this later." NEVER invent answers.
4. Keep any camera/audio observations strictly supportive for framing and audibility—never claim to measure confidence, emotions, personality, or intelligence from facial expressions.`
        : `You are VECTORA's live voice ${contextMode} guiding a student exploring "${careerTitle}". Keep responses conversational, concise (2-4 sentences), encouraging, and practical.`;

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;

    try {
      liveSession = await ai.live.connect({
        model: FREE_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ ready: true }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (err) => {
            console.error('Gemini Live error:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ error: 'Voice session encountered an error.' }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.close();
            }
          },
        },
      });
    } catch (error: unknown) {
      console.error('Failed to open Gemini Live session:', error);
      const msg = error instanceof Error ? error.message : 'Unable to connect to Gemini Live API.';
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: msg }));
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (rawData) => {
      if (!liveSession) return;
      try {
        const payload = JSON.parse(rawData.toString()) as {
          audio?: string;
          video?: string;
          text?: string;
        };
        if (payload.audio) {
          liveSession.sendRealtimeInput({
            audio: { data: payload.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (payload.video) {
          liveSession.sendRealtimeInput({
            video: { data: payload.video, mimeType: 'image/jpeg' },
          });
        } else if (payload.text) {
          liveSession.sendRealtimeInput({ text: payload.text });
        }
      } catch (err) {
        console.error('Error forwarding live media input:', err);
      }
    });

    clientWs.on('close', () => {
      try {
        liveSession?.close();
      } catch {
        // ignore close errors
      }
    });
  });

  // Vite dev middleware or static dist
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Vectora server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
