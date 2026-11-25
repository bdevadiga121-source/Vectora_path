import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { careerVideos, studentWorkspaces, users } from './schema.ts';
import type {
  AdminPermission,
  CareerVideoCheckpoint,
  CareerVideoSubtitleCue,
  InterviewState,
  StudentWorkspaceState,
} from '../types.ts';

export function createInitialInterview(): InterviewState {
  return {
    messages: [],
    phase: 1,
    phaseLabel: 'AI Introduction & Warmup',
    isComplete: false,
    suggestedReplies: [],
    demonstratedAbilities: [],
    interestsSummary: [],
    strengthsSummary: [],
  };
}

export function createInitialWorkspace(email: string, fullName: string): StudentWorkspaceState {
  return {
    profile: {
      fullName,
      email,
      avatarUrl: 'atlas-orbit',
      classGrade: '12th Standard',
      educationStage: '12th Standard',
      academicStream: 'Science & Mathematics (PCM)',
      topSubjects: ['Mathematics', 'Computer Science', 'Physics'],
      hobbies: ['Coding & Robotics', 'Chess & Strategy'],
      preferredActivities: ['Hands-on Prototyping', 'Analytical Problem Solving'],
      location: '',
      bio: '',
      curiosities: '',
      workPreference: 'Building interactive systems and solving analytical puzzles',
      longTermGoal: '',
    },
    interview: createInitialInterview(),
    recommendations: [],
    selectedCareerId: null,
    compareCareerIds: [],
    roadmap: [],
    completedMissionIds: [],
    missionResults: {},
    skills: {
      'Analytical Reasoning': 52,
      'Systems Architecture': 46,
      'Applied Mathematics': 50,
      'Communication': 54,
      'Execution & Delivery': 48,
    },
    unlockedBuildingIds: ['building-admissions', 'building-mentor'],
    watchedVideoSessionIds: [],
    completed3DActivityIds: [],
    mentorHistory: [],
    satisfactionStatus: 'undecided',
    advancedUnlocked: false,
    progressAnalytics: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function getOrCreateUser(uid: string, email: string, fullName?: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (fullName || cleanEmail.split('@')[0] || 'Student').trim();
    const ownerEmail = (process.env.ADMIN_EMAIL || 'b.devadiga121@gmail.com').trim().toLowerCase();
    const isInitialOwner = cleanEmail === ownerEmail;
    const now = new Date();
    const fullAdminPermissions: AdminPermission[] = [
      'manage_students',
      'manage_careers',
      'manage_ai',
      'manage_worlds',
      'manage_missions',
      'manage_roadmaps',
      'view_analytics',
      'manage_security',
    ];

    // Atomic insert-if-absent to prevent unique constraint race conditions under concurrent requests
    await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        fullName: cleanName,
        role: isInitialOwner ? 'admin' : 'student',
        status: 'active',
        permissionsJson: isInitialOwner ? fullAdminPermissions : [],
        lastActiveAt: now,
      })
      .onConflictDoNothing({ target: users.uid });

    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    const current = existing[0];
    if (!current) {
      throw new Error('User record not found after upsert.');
    }

    const nextRole = isInitialOwner ? 'admin' : current.role === 'admin' ? 'admin' : 'student';
    const nextPermissions: AdminPermission[] = isInitialOwner
      ? fullAdminPermissions
      : nextRole === 'admin'
        ? ((current.permissionsJson || []) as AdminPermission[])
        : [];

    const updated = await db
      .update(users)
      .set({
        email: cleanEmail,
        fullName: cleanName,
        role: nextRole,
        permissionsJson: nextPermissions,
        lastActiveAt: now,
      })
      .where(eq(users.id, current.id))
      .returning();

    return updated[0] || current;
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

function normalizeInterviewState(raw: InterviewState | null | undefined): InterviewState {
  const base = createInitialInterview();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    suggestedReplies: Array.isArray(raw.suggestedReplies) ? raw.suggestedReplies : [],
    demonstratedAbilities: Array.isArray(raw.demonstratedAbilities) ? raw.demonstratedAbilities : [],
    interestsSummary: Array.isArray(raw.interestsSummary) ? raw.interestsSummary : [],
    strengthsSummary: Array.isArray(raw.strengthsSummary) ? raw.strengthsSummary : [],
    areasToImprove: Array.isArray(raw.areasToImprove) ? raw.areasToImprove : undefined,
    skippedQuestions: Array.isArray(raw.skippedQuestions) ? raw.skippedQuestions : undefined,
    abilityQuestions: Array.isArray(raw.abilityQuestions) ? raw.abilityQuestions : undefined,
  };
}

export async function getWorkspaceForUser(
  userId: number,
  email: string,
  fullName: string
): Promise<StudentWorkspaceState> {
  try {
    const existing = await db
      .select()
      .from(studentWorkspaces)
      .where(eq(studentWorkspaces.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      return {
        profile: row.profileJson
          ? {
              ...row.profileJson,
              topSubjects: Array.isArray(row.profileJson.topSubjects)
                ? row.profileJson.topSubjects
                : [],
            }
          : null,
        interview: normalizeInterviewState(row.interviewJson),
        recommendations: Array.isArray(row.recommendationsJson) ? row.recommendationsJson : [],
        selectedCareerId: row.selectedCareerId,
        compareCareerIds: Array.isArray(row.compareCareerIdsJson) ? row.compareCareerIdsJson : [],
        roadmap: Array.isArray(row.roadmapJson) ? row.roadmapJson : [],
        completedMissionIds: Array.isArray(row.completedMissionIdsJson)
          ? row.completedMissionIdsJson
          : [],
        missionResults: row.missionResultsJson || {},
        skills: row.skillsJson || {},
        unlockedBuildingIds: Array.isArray(row.unlockedBuildingIdsJson)
          ? row.unlockedBuildingIdsJson
          : ['building-admissions', 'building-mentor'],
        watchedVideoSessionIds: Array.isArray(row.watchedVideoSessionIdsJson)
          ? row.watchedVideoSessionIdsJson
          : [],
        completed3DActivityIds: Array.isArray(row.completed3DActivityIdsJson)
          ? row.completed3DActivityIdsJson
          : [],
        mentorHistory: Array.isArray(row.mentorHistoryJson) ? row.mentorHistoryJson : [],
        satisfactionStatus:
          (row.satisfactionStatus as StudentWorkspaceState['satisfactionStatus']) || 'undecided',
        advancedUnlocked: Boolean(row.advancedUnlocked),
        progressAnalytics: row.progressAnalyticsJson ?? null,
        updatedAt: row.updatedAt.toISOString(),
      };
    }

    const initial = createInitialWorkspace(email, fullName);
    await db
      .insert(studentWorkspaces)
      .values({
        userId,
        profileJson: initial.profile,
        interviewJson: initial.interview,
        recommendationsJson: initial.recommendations,
        selectedCareerId: initial.selectedCareerId,
        compareCareerIdsJson: initial.compareCareerIds,
        roadmapJson: initial.roadmap,
        completedMissionIdsJson: initial.completedMissionIds,
        missionResultsJson: initial.missionResults,
        skillsJson: initial.skills,
        unlockedBuildingIdsJson: initial.unlockedBuildingIds,
        watchedVideoSessionIdsJson: initial.watchedVideoSessionIds ?? [],
        completed3DActivityIdsJson: initial.completed3DActivityIds ?? [],
        mentorHistoryJson: initial.mentorHistory,
        satisfactionStatus: initial.satisfactionStatus,
        advancedUnlocked: initial.advancedUnlocked,
        progressAnalyticsJson: initial.progressAnalytics,
        updatedAt: new Date(),
      })
      .onConflictDoNothing({ target: studentWorkspaces.userId });

    const created = await db
      .select()
      .from(studentWorkspaces)
      .where(eq(studentWorkspaces.userId, userId))
      .limit(1);

    if (created.length > 0) {
      const row = created[0];
      return {
        profile: row.profileJson,
        interview: normalizeInterviewState(row.interviewJson),
        recommendations: Array.isArray(row.recommendationsJson) ? row.recommendationsJson : [],
        selectedCareerId: row.selectedCareerId,
        compareCareerIds: Array.isArray(row.compareCareerIdsJson) ? row.compareCareerIdsJson : [],
        roadmap: Array.isArray(row.roadmapJson) ? row.roadmapJson : [],
        completedMissionIds: Array.isArray(row.completedMissionIdsJson)
          ? row.completedMissionIdsJson
          : [],
        missionResults: row.missionResultsJson || {},
        skills: row.skillsJson || {},
        unlockedBuildingIds: Array.isArray(row.unlockedBuildingIdsJson)
          ? row.unlockedBuildingIdsJson
          : ['building-admissions', 'building-mentor'],
        watchedVideoSessionIds: Array.isArray(row.watchedVideoSessionIdsJson)
          ? row.watchedVideoSessionIdsJson
          : [],
        completed3DActivityIds: Array.isArray(row.completed3DActivityIdsJson)
          ? row.completed3DActivityIdsJson
          : [],
        mentorHistory: Array.isArray(row.mentorHistoryJson) ? row.mentorHistoryJson : [],
        satisfactionStatus:
          (row.satisfactionStatus as StudentWorkspaceState['satisfactionStatus']) || 'undecided',
        advancedUnlocked: Boolean(row.advancedUnlocked),
        progressAnalytics: row.progressAnalyticsJson ?? null,
        updatedAt: row.updatedAt.toISOString(),
      };
    }

    return initial;
  } catch (error) {
    console.error('Database workspace fetch failed:', error);
    throw new Error('Failed to load student workspace.', { cause: error });
  }
}

export async function saveWorkspaceForUser(
  userId: number,
  workspace: StudentWorkspaceState
): Promise<StudentWorkspaceState> {
  try {
    const now = new Date();
    const watchedVideoSessionIds = Array.isArray(workspace.watchedVideoSessionIds)
      ? workspace.watchedVideoSessionIds
      : [];
    const completed3DActivityIds = Array.isArray(workspace.completed3DActivityIds)
      ? workspace.completed3DActivityIds
      : [];

    await db
      .insert(studentWorkspaces)
      .values({
        userId,
        profileJson: workspace.profile,
        interviewJson: workspace.interview,
        recommendationsJson: workspace.recommendations,
        selectedCareerId: workspace.selectedCareerId,
        compareCareerIdsJson: workspace.compareCareerIds,
        roadmapJson: workspace.roadmap,
        completedMissionIdsJson: workspace.completedMissionIds,
        missionResultsJson: workspace.missionResults,
        skillsJson: workspace.skills,
        unlockedBuildingIdsJson: workspace.unlockedBuildingIds,
        watchedVideoSessionIdsJson: watchedVideoSessionIds,
        completed3DActivityIdsJson: completed3DActivityIds,
        mentorHistoryJson: workspace.mentorHistory,
        satisfactionStatus: workspace.satisfactionStatus,
        advancedUnlocked: workspace.advancedUnlocked,
        progressAnalyticsJson: workspace.progressAnalytics,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: studentWorkspaces.userId,
        set: {
          profileJson: workspace.profile,
          interviewJson: workspace.interview,
          recommendationsJson: workspace.recommendations,
          selectedCareerId: workspace.selectedCareerId,
          compareCareerIdsJson: workspace.compareCareerIds,
          roadmapJson: workspace.roadmap,
          completedMissionIdsJson: workspace.completedMissionIds,
          missionResultsJson: workspace.missionResults,
          skillsJson: workspace.skills,
          unlockedBuildingIdsJson: workspace.unlockedBuildingIds,
          watchedVideoSessionIdsJson: watchedVideoSessionIds,
          completed3DActivityIdsJson: completed3DActivityIds,
          mentorHistoryJson: workspace.mentorHistory,
          satisfactionStatus: workspace.satisfactionStatus,
          advancedUnlocked: workspace.advancedUnlocked,
          progressAnalyticsJson: workspace.progressAnalytics,
          updatedAt: now,
        },
      });

    if (workspace.profile) {
      await db
        .update(users)
        .set({
          fullName: workspace.profile.fullName || undefined,
          avatarUrl: workspace.profile.avatarUrl ?? undefined,
          lastActiveAt: now,
        })
        .where(eq(users.id, userId));
    }

    return {
      ...workspace,
      watchedVideoSessionIds,
      completed3DActivityIds,
      updatedAt: now.toISOString(),
    };
  } catch (error) {
    console.error('Database workspace save failed:', error);
    throw new Error('Failed to save student workspace.', { cause: error });
  }
}

export async function saveCareerVideo(params: {
  userId: number;
  careerId: string;
  prompt: string;
  aspectRatio: string;
  interactionId: string | null;
  mimeType: string;
  videoDataBase64: string;
}) {
  try {
    const inserted = await db
      .insert(careerVideos)
      .values({
        userId: params.userId,
        careerId: params.careerId,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        interactionId: params.interactionId,
        mimeType: params.mimeType,
        videoDataBase64: params.videoDataBase64,
      })
      .returning({
        id: careerVideos.id,
        careerId: careerVideos.careerId,
        prompt: careerVideos.prompt,
        aspectRatio: careerVideos.aspectRatio,
        interactionId: careerVideos.interactionId,
        mimeType: careerVideos.mimeType,
        createdAt: careerVideos.createdAt,
      });
    return inserted[0];
  } catch (error) {
    console.error('Database video insert failed:', error);
    throw new Error('Failed to save generated video.', { cause: error });
  }
}

export async function listCareerVideosForUser(userId: number) {
  try {
    return await db
      .select({
        id: careerVideos.id,
        careerId: careerVideos.careerId,
        prompt: careerVideos.prompt,
        aspectRatio: careerVideos.aspectRatio,
        interactionId: careerVideos.interactionId,
        mimeType: careerVideos.mimeType,
        videoDataBase64: careerVideos.videoDataBase64,
        createdAt: careerVideos.createdAt,
      })
      .from(careerVideos)
      .where(eq(careerVideos.userId, userId))
      .orderBy(desc(careerVideos.createdAt))
      .limit(8);
  } catch (error) {
    console.error('Database video fetch failed:', error);
    throw new Error('Failed to fetch generated videos.', { cause: error });
  }
}

export async function findCachedCareerVideoSession(careerId: string, sessionKey: string) {
  try {
    const rows = await db
      .select({
        id: careerVideos.id,
        careerId: careerVideos.careerId,
        sessionKey: careerVideos.sessionKey,
        levelNumber: careerVideos.levelNumber,
        sessionTitle: careerVideos.sessionTitle,
        prompt: careerVideos.prompt,
        aspectRatio: careerVideos.aspectRatio,
        interactionId: careerVideos.interactionId,
        mimeType: careerVideos.mimeType,
        videoDataBase64: careerVideos.videoDataBase64,
        narrationScript: careerVideos.narrationScript,
        subtitles: careerVideos.subtitlesJson,
        checkpoint: careerVideos.checkpointJson,
        audioBase64: careerVideos.audioBase64,
        createdAt: careerVideos.createdAt,
      })
      .from(careerVideos)
      .where(and(eq(careerVideos.careerId, careerId), eq(careerVideos.sessionKey, sessionKey)))
      .orderBy(desc(careerVideos.createdAt))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database cached career video session lookup failed:', error);
    return null;
  }
}

export async function listCachedCareerVideoSessions(careerId: string) {
  try {
    const rows = await db
      .select({
        id: careerVideos.id,
        careerId: careerVideos.careerId,
        sessionKey: careerVideos.sessionKey,
        levelNumber: careerVideos.levelNumber,
        sessionTitle: careerVideos.sessionTitle,
        prompt: careerVideos.prompt,
        aspectRatio: careerVideos.aspectRatio,
        interactionId: careerVideos.interactionId,
        mimeType: careerVideos.mimeType,
        videoDataBase64: careerVideos.videoDataBase64,
        narrationScript: careerVideos.narrationScript,
        subtitles: careerVideos.subtitlesJson,
        checkpoint: careerVideos.checkpointJson,
        audioBase64: careerVideos.audioBase64,
        createdAt: careerVideos.createdAt,
      })
      .from(careerVideos)
      .where(eq(careerVideos.careerId, careerId))
      .orderBy(desc(careerVideos.createdAt))
      .limit(20);

    const bySession = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (row.sessionKey && !bySession.has(row.sessionKey)) {
        bySession.set(row.sessionKey, row);
      }
    }
    return Array.from(bySession.values());
  } catch (error) {
    console.error('Database cached career video sessions fetch failed:', error);
    return [];
  }
}

export async function saveCareerVideoSession(params: {
  userId: number;
  careerId: string;
  sessionKey: string;
  levelNumber: number;
  sessionTitle: string;
  prompt: string;
  aspectRatio: string;
  interactionId: string | null;
  mimeType: string;
  videoDataBase64: string;
  narrationScript: string;
  subtitles: CareerVideoSubtitleCue[];
  checkpoint: CareerVideoCheckpoint | null;
  audioBase64: string | null;
}) {
  try {
    const inserted = await db
      .insert(careerVideos)
      .values({
        userId: params.userId,
        careerId: params.careerId,
        sessionKey: params.sessionKey,
        levelNumber: params.levelNumber,
        sessionTitle: params.sessionTitle,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        interactionId: params.interactionId,
        mimeType: params.mimeType,
        videoDataBase64: params.videoDataBase64,
        narrationScript: params.narrationScript,
        subtitlesJson: params.subtitles,
        checkpointJson: params.checkpoint,
        audioBase64: params.audioBase64,
      })
      .returning({
        id: careerVideos.id,
        careerId: careerVideos.careerId,
        sessionKey: careerVideos.sessionKey,
        levelNumber: careerVideos.levelNumber,
        sessionTitle: careerVideos.sessionTitle,
        prompt: careerVideos.prompt,
        aspectRatio: careerVideos.aspectRatio,
        interactionId: careerVideos.interactionId,
        mimeType: careerVideos.mimeType,
        videoDataBase64: careerVideos.videoDataBase64,
        narrationScript: careerVideos.narrationScript,
        subtitles: careerVideos.subtitlesJson,
        checkpoint: careerVideos.checkpointJson,
        audioBase64: careerVideos.audioBase64,
        createdAt: careerVideos.createdAt,
      });
    return inserted[0];
  } catch (error) {
    console.error('Database career video session insert failed:', error);
    throw new Error('Failed to save generated career session video.', { cause: error });
  }
}
