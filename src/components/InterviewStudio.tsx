import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  HelpCircle,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  SkipForward,
  Video,
} from 'lucide-react';
import { stepAiInterview } from '../api/client';
import { AbilityQuestionAssessment } from './AbilityQuestionAssessment';
import { VideoCallInterviewer } from './VideoCallInterviewer';
import type {
  AbilityAssessmentReport,
  AbilityQuestionItem,
  InterviewMessage,
  InterviewState,
  StudentProfile,
  VideoInterviewReport,
} from '../types';

interface InterviewStudioProps {
  profile: StudentProfile;
  interview: InterviewState;
  onUpdateInterview: (next: InterviewState) => void;
  onGenerateRecommendations: () => Promise<void>;
  generatingRecs: boolean;
}

const PHASE_STEPS = [
  { num: '01', label: 'Analytical Reasoning' },
  { num: '02', label: 'Subject Mastery' },
  { num: '03', label: 'Problem Solving' },
  { num: '04', label: 'Situational Judgment' },
  { num: '05', label: 'Ability Evaluation' },
];

export const InterviewStudio: React.FC<InterviewStudioProps> = ({
  profile,
  interview,
  onUpdateInterview,
  onGenerateRecommendations,
  generatingRecs,
}) => {
  const messages = Array.isArray(interview?.messages) ? interview.messages : [];
  const suggestedReplies = Array.isArray(interview?.suggestedReplies)
    ? interview.suggestedReplies
    : [];
  const demonstratedAbilities = Array.isArray(interview?.demonstratedAbilities)
    ? interview.demonstratedAbilities
    : [];
  const interestsSummary = Array.isArray(interview?.interestsSummary)
    ? interview.interestsSummary
    : [];
  const strengthsSummary = Array.isArray(interview?.strengthsSummary)
    ? interview.strengthsSummary
    : [];
  const areasToImprove = Array.isArray(interview?.areasToImprove)
    ? interview.areasToImprove
    : Array.isArray(interview?.videoInterviewReport?.improvementPlan)
      ? interview.videoInterviewReport.improvementPlan
      : [];
  const topSubjects = Array.isArray(profile?.topSubjects) ? profile.topSubjects : [];

  const [mode, setMode] = useState<'voice' | 'questions' | 'text'>(() => {
    if (interview?.abilityAssessment && !interview?.videoInterviewReport) return 'questions';
    if (
      messages.length > 0 &&
      !interview?.videoInterviewReport &&
      !interview?.abilityAssessment
    ) {
      return 'text';
    }
    return 'voice';
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, loading]);

  const startInterview = async (fresh = false) => {
    setError(null);
    setLoading(true);
    try {
      const res = await stepAiInterview({
        profile,
        messages: fresh ? [] : messages.map((m) => ({ role: m.role, content: m.content })),
        startFresh: fresh,
      });
      const aiMsg: InterviewMessage = {
        id: `msg_${Date.now()}`,
        role: 'ai',
        content: res.reply,
        phase: res.phase,
        phaseLabel: res.phaseLabel,
        timestamp: new Date().toISOString(),
      };
      onUpdateInterview({
        ...interview,
        messages: fresh ? [aiMsg] : [...messages, aiMsg],
        phase: res.phase,
        phaseLabel: res.phaseLabel,
        isComplete: Boolean(res.isComplete),
        suggestedReplies: Array.isArray(res.suggestedReplies) ? res.suggestedReplies : [],
        demonstratedAbilities: Array.isArray(res.demonstratedAbilities)
          ? res.demonstratedAbilities
          : [],
        interestsSummary: Array.isArray(res.interestsSummary) ? res.interestsSummary : [],
        strengthsSummary: Array.isArray(res.strengthsSummary) ? res.strengthsSummary : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start interview');
    } finally {
      setLoading(false);
    }
  };

  const sendAnswer = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    setInput('');

    const studentMsg: InterviewMessage = {
      id: `msg_stu_${Date.now()}`,
      role: 'student',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    const nextMessages = [...messages, studentMsg];
    onUpdateInterview({
      ...interview,
      messages: nextMessages,
      suggestedReplies: [],
    });

    setLoading(true);
    try {
      const res = await stepAiInterview({
        profile,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        studentReply: trimmed,
      });
      const aiMsg: InterviewMessage = {
        id: `msg_ai_${Date.now() + 1}`,
        role: 'ai',
        content: res.reply,
        phase: res.phase,
        phaseLabel: res.phaseLabel,
        timestamp: new Date().toISOString(),
      };
      onUpdateInterview({
        ...interview,
        messages: [...nextMessages, aiMsg],
        phase: res.phase,
        phaseLabel: res.phaseLabel,
        isComplete: Boolean(res.isComplete),
        suggestedReplies: Array.isArray(res.suggestedReplies) ? res.suggestedReplies : [],
        demonstratedAbilities:
          Array.isArray(res.demonstratedAbilities) && res.demonstratedAbilities.length > 0
            ? res.demonstratedAbilities
            : demonstratedAbilities,
        interestsSummary:
          Array.isArray(res.interestsSummary) && res.interestsSummary.length > 0
            ? res.interestsSummary
            : interestsSummary,
        strengthsSummary:
          Array.isArray(res.strengthsSummary) && res.strengthsSummary.length > 0
            ? res.strengthsSummary
            : strengthsSummary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#6A5ACD]/35 pb-6">
        <div>
          <div className="text-xs font-mono font-medium text-[#F4A62A]">
            AI Ability Evaluation · {profile.fullName} · {profile.educationStage}
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-display font-bold text-[#F0D9B5] text-balance">
            Targeted Ability Questions & Interactive Assessment
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-[#2D2B55] rounded-xl border border-[#6A5ACD]/45">
            <button
              type="button"
              onClick={() => setMode('voice')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'voice'
                  ? 'bg-[#F4A62A] text-[#1A1A1F]'
                  : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>AI Video Call</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('questions')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'questions'
                  ? 'bg-[#F4A62A] text-[#1A1A1F]'
                  : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Ability Questions</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'text'
                  ? 'bg-[#F4A62A] text-[#1A1A1F]'
                  : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Conversational Q&A</span>
            </button>
          </div>
          {messages.length > 0 && mode === 'text' && (
            <button
              type="button"
              onClick={() => startInterview(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-[#6A5ACD]/55 bg-[#2D2B55] px-4 py-2 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/30 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart Q&A</span>
            </button>
          )}
        </div>
      </div>

      {/* Unified Architectural 5-Dimension Progress Rail */}
      <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#6A5ACD]/35 overflow-hidden">
        {PHASE_STEPS.map((step, idx) => {
          const stepNum = idx + 1;
          const completed = interview.isComplete || (mode === 'text' && interview.phase > stepNum);
          const active =
            !interview.isComplete &&
            (mode === 'questions' ? stepNum === 1 : interview.phase === stepNum);
          return (
            <div
              key={step.num}
              className={`px-4 py-3 text-xs transition-colors ${
                active
                  ? 'bg-[#F4A62A]/15 text-[#F0D9B5]'
                  : completed
                    ? 'bg-emerald-500/12 text-emerald-100'
                    : 'bg-[#2D2B55] text-[#D6C7DF]/70'
              }`}
            >
              <div
                className={`font-mono text-[11px] font-semibold tabular-nums ${
                  active ? 'text-[#F4A62A]' : completed ? 'text-emerald-400' : 'text-[#A678B9]'
                }`}
              >
                {step.num} {completed ? '· Evaluated' : active ? '· Active' : ''}
              </div>
              <div className={`mt-0.5 truncate ${active || completed ? 'font-semibold text-[#F0D9B5]' : 'font-medium text-[#D6C7DF]'}`}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Assessment / Interview Stage */}
        {mode === 'questions' ? (
          <div className="lg:col-span-8">
            <AbilityQuestionAssessment
              profile={profile}
              savedQuestions={interview.abilityQuestions}
              savedAssessment={interview.abilityAssessment}
              generatingRecs={generatingRecs}
              onGenerateRecommendations={onGenerateRecommendations}
              onQuestionsLoaded={(questions: AbilityQuestionItem[]) => {
                onUpdateInterview({
                  ...interview,
                  abilityQuestions: questions,
                  abilityAssessment: null,
                });
              }}
              onAssessmentComplete={(
                assessment: AbilityAssessmentReport,
                qaMessages: InterviewMessage[]
              ) => {
                onUpdateInterview({
                  ...interview,
                  messages: Array.isArray(qaMessages) ? qaMessages : messages,
                  phase: 5,
                  phaseLabel: 'AI Ability Questions Evaluated',
                  isComplete: true,
                  demonstratedAbilities: Array.isArray(assessment.demonstratedAbilities)
                    ? assessment.demonstratedAbilities
                    : demonstratedAbilities,
                  interestsSummary: Array.isArray(assessment.interestsSummary)
                    ? assessment.interestsSummary
                    : interestsSummary,
                  strengthsSummary: Array.isArray(assessment.strengthsSummary)
                    ? assessment.strengthsSummary
                    : strengthsSummary,
                  abilityAssessment: assessment,
                });
              }}
            />
          </div>
        ) : mode === 'voice' ? (
          <div className="lg:col-span-8">
            <VideoCallInterviewer
              profile={profile}
              existingReport={interview.videoInterviewReport}
              generatingRecs={generatingRecs}
              onGenerateRecommendations={onGenerateRecommendations}
              onReportComplete={(report: VideoInterviewReport, transcriptMessages: InterviewMessage[]) => {
                onUpdateInterview({
                  ...interview,
                  messages: transcriptMessages.length > 0 ? transcriptMessages : messages,
                  phase: 5,
                  phaseLabel: 'Video Call Performance Report Ready',
                  isComplete: true,
                  demonstratedAbilities:
                    Array.isArray(report.demonstratedAbilities) && report.demonstratedAbilities.length > 0
                      ? report.demonstratedAbilities
                      : demonstratedAbilities,
                  interestsSummary:
                    Array.isArray(report.interestsSummary) && report.interestsSummary.length > 0
                      ? report.interestsSummary
                      : interestsSummary,
                  strengthsSummary:
                    Array.isArray(report.strengthsSummary) && report.strengthsSummary.length > 0
                      ? report.strengthsSummary
                      : strengthsSummary,
                  areasToImprove:
                    Array.isArray(report.improvementPlan) && report.improvementPlan.length > 0
                      ? report.improvementPlan
                      : areasToImprove,
                  videoInterviewReport: report,
                });
              }}
            />
          </div>
        ) : (
          <div className="lg:col-span-8 bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl flex flex-col min-h-[540px] overflow-hidden shadow-[0_24px_48px_rgba(12,11,22,0.55)]">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                <div className="max-w-md space-y-4">
                  <h2 className="text-xl font-display font-bold text-[#F0D9B5]">
                    Ready for AI-led Ability Questions
                  </h2>
                  <p className="text-sm leading-relaxed text-[#D6C7DF]">
                    Our AI will ask targeted analytical, subject, and situational questions one by one to check your demonstrated abilities.
                  </p>
                  <button
                    type="button"
                    onClick={() => startInterview(true)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-6 py-3 text-sm font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-60 transition-colors"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    <span>Start Question Session</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5 max-h-[440px]">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'student' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="mb-1.5 text-xs font-medium text-[#D6C7DF]">
                        {msg.role === 'ai'
                          ? `AI Career Assessor${msg.phaseLabel ? ` · ${msg.phaseLabel}` : ''}`
                          : profile.fullName}
                      </div>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === 'student'
                            ? 'bg-[#F4A62A] text-[#1A1A1F] font-medium'
                            : 'bg-[#1A1A1F] text-[#F0D9B5] border border-[#6A5ACD]/45'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex items-center gap-2 text-xs text-[#D6C7DF] py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#F4A62A]" />
                      <span>Evaluating your response and preparing next question...</span>
                    </div>
                  )}
                </div>

                {/* Suggested quick replies + composer */}
                <div className="border-t border-[#6A5ACD]/35 p-5 bg-[#1A1A1F]/65 space-y-3">
                  {error && (
                    <div className="rounded-xl border border-red-500/40 bg-red-950/60 px-3.5 py-2 text-xs text-red-200">
                      {error}
                    </div>
                  )}

                  {interview.isComplete ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1A1A1F] border border-emerald-500/40 rounded-xl p-4">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-semibold text-[#F0D9B5]">
                            Ability Evaluation Complete
                          </div>
                          <p className="text-xs text-[#D6C7DF] mt-0.5">
                            Your demonstrated abilities are ready to be matched against career requirements.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onGenerateRecommendations}
                        disabled={generatingRecs}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4A62A] px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                      >
                        {generatingRecs ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                        <span>Rank Career Matches</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {suggestedReplies.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-xs font-medium text-[#D6C7DF]">
                            Quick Responses
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {suggestedReplies.map((sr) => (
                              <button
                                key={sr}
                                type="button"
                                disabled={loading}
                                onClick={() => sendAnswer(sr)}
                                className="text-left rounded-xl border border-[#6A5ACD]/50 bg-[#2D2B55] px-3 py-2 text-xs font-medium text-[#F0D9B5] hover:border-[#F4A62A] hover:text-[#F4A62A] transition-colors"
                              >
                                {sr}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            sendAnswer(
                              'Could you please explain that question differently with a simple example?'
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#6A5ACD]/50 bg-[#2D2B55] px-3 py-1.5 text-[11px] font-medium text-[#F0D9B5] hover:border-[#F4A62A] transition-colors"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-[#F4A62A]" />
                          <span>Explain Differently</span>
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            sendAnswer(
                              'I would like to pass this question for now and move to the next topic.'
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#6A5ACD]/50 bg-[#2D2B55] px-3 py-1.5 text-[11px] font-medium text-[#D6C7DF] hover:border-[#A678B9] hover:text-[#F0D9B5] transition-colors"
                        >
                          <SkipForward className="w-3.5 h-3.5 text-[#A678B9]" />
                          <span>Pass Question for Now</span>
                        </button>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          sendAnswer(input);
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          disabled={loading}
                          placeholder="Answer the AI question..."
                          className="flex-1 rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-4 py-2.5 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A]"
                        />
                        <button
                          type="submit"
                          disabled={loading || !input.trim()}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Send className="w-4 h-4" />
                          <span>Send</span>
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Right Side Panel: Profile & Demonstrated Abilities */}
        <aside className="lg:col-span-4 space-y-5">
          {interview.isComplete && (
            <div className="bg-[#2D2B55] border border-emerald-500/45 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-semibold text-emerald-400">
                  Stage 04 · Interview Summary
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs text-[#F0D9B5] leading-relaxed">
                {interview.aiInterviewSummary ||
                  interview.videoInterviewReport?.followUpEvaluation ||
                  interview.abilityAssessment?.summary ||
                  'Your interview and assessment are complete. Explore Careers is now unlocked with personalized matches.'}
              </p>
              {strengthsSummary.length > 0 && (
                <div className="pt-2 border-t border-[#6A5ACD]/35">
                  <div className="text-[11px] font-semibold text-emerald-400 mb-1.5">
                    Your Strengths
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {strengthsSummary.map((st) => (
                      <span
                        key={st}
                        className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200"
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {areasToImprove.length > 0 && (
                <div className="pt-2 border-t border-[#6A5ACD]/35">
                  <div className="text-[11px] font-semibold text-[#F4A62A] mb-1.5">
                    Areas to Improve
                  </div>
                  <ul className="space-y-1 text-[11px] text-[#D6C7DF]">
                    {areasToImprove.slice(0, 3).map((area) => (
                      <li key={area} className="flex items-start gap-1.5">
                        <span className="text-[#F4A62A]">·</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6">
            <div className="text-xs font-mono font-medium text-[#F4A62A]">
              Student Baseline
            </div>
            <dl className="mt-4 divide-y divide-[#6A5ACD]/35 text-xs">
              <div className="pb-3">
                <dt className="text-[#D6C7DF]">Academic Stream</dt>
                <dd className="mt-0.5 font-semibold text-[#F0D9B5]">{profile.academicStream}</dd>
              </div>
              <div className="py-3">
                <dt className="text-[#D6C7DF]">Top Subjects</dt>
                <dd className="mt-0.5 font-semibold text-[#F0D9B5]">{topSubjects.join(' · ')}</dd>
              </div>
              <div className="pt-3">
                <dt className="text-[#D6C7DF]">Working Style</dt>
                <dd className="mt-0.5 font-semibold text-[#F0D9B5]">{profile.workPreference}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6">
            <div className="text-xs font-mono font-medium text-[#F4A62A]">
              Demonstrated Abilities
            </div>
            {demonstratedAbilities.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-[#D6C7DF]">
                Join the AI Video Call, answer the 5 AI Ability Questions, or complete Conversational Q&amp;A to generate your ability profile and ranked career matches.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {demonstratedAbilities.map((ab) => (
                  <div key={ab.name}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#F0D9B5]">{ab.name}</span>
                      <span className="font-mono tabular-nums text-[#F4A62A] font-semibold">
                        {ab.level}/100
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#1A1A1F] overflow-hidden">
                      <div
                        className="h-full bg-[#F4A62A] rounded-full"
                        style={{ width: `${Math.min(100, Math.max(10, ab.level))}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-[#D6C7DF] leading-relaxed">{ab.evidence}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
