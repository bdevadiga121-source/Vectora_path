import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { evaluateAbilityQuestions, generateAbilityQuestions } from '../api/client';
import type {
  AbilityAssessmentReport,
  AbilityQuestionAnswer,
  AbilityQuestionItem,
  InterviewMessage,
  StudentProfile,
} from '../types';

interface AbilityQuestionAssessmentProps {
  profile: StudentProfile;
  savedQuestions?: AbilityQuestionItem[];
  savedAssessment?: AbilityAssessmentReport | null;
  generatingRecs: boolean;
  onQuestionsLoaded: (questions: AbilityQuestionItem[]) => void;
  onAssessmentComplete: (
    assessment: AbilityAssessmentReport,
    transcriptMessages: InterviewMessage[]
  ) => void;
  onGenerateRecommendations: () => Promise<void>;
}

export const AbilityQuestionAssessment: React.FC<AbilityQuestionAssessmentProps> = ({
  profile,
  savedQuestions,
  savedAssessment,
  generatingRecs,
  onQuestionsLoaded,
  onAssessmentComplete,
  onGenerateRecommendations,
}) => {
  const [questions, setQuestions] = useState<AbilityQuestionItem[]>(savedQuestions || []);
  const [answers, setAnswers] = useState<Record<string, AbilityQuestionAnswer>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assessment, setAssessment] = useState<AbilityAssessmentReport | null>(
    savedAssessment || null
  );
  const [error, setError] = useState<string | null>(null);

  const loadNewQuestions = async () => {
    setError(null);
    setAssessment(null);
    setAnswers({});
    setActiveIdx(0);
    setLoadingQuestions(true);
    try {
      const res = await generateAbilityQuestions(profile);
      const safeQuestions = Array.isArray(res.questions) ? res.questions : [];
      setQuestions(safeQuestions);
      onQuestionsLoaded(safeQuestions);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to generate ability-check questions right now.'
      );
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if ((!savedQuestions || savedQuestions.length === 0) && !loadingQuestions) {
      loadNewQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (savedQuestions && savedQuestions.length > 0 && questions.length === 0) {
      setQuestions(savedQuestions);
    }
  }, [savedQuestions, questions.length]);

  useEffect(() => {
    if (savedAssessment && !assessment) {
      setAssessment(savedAssessment);
    }
  }, [savedAssessment, assessment]);

  const currentQuestion = questions[activeIdx];
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const updateSelection = (questionId: string, optionIdx: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        selectedOptionIndex: optionIdx,
        writtenExplanation: prev[questionId]?.writtenExplanation || '',
      },
    }));
  };

  const updateExplanation = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        selectedOptionIndex: prev[questionId]?.selectedOptionIndex ?? -1,
        writtenExplanation: text,
      },
    }));
  };

  const handleSubmitAll = async () => {
    if (!allAnswered || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const answerList = questions.map((q) => answers[q.id]);
      const res = await evaluateAbilityQuestions({
        profile,
        questions,
        answers: answerList,
      });

      const qaMessages: InterviewMessage[] = questions.flatMap((q) => {
        const ans = answers[q.id];
        const chosenOpt = q.options[ans?.selectedOptionIndex] || '';
        const reasoning = ans?.writtenExplanation?.trim();
        return [
          {
            id: `aq_ai_${q.id}_${Date.now()}`,
            role: 'ai' as const,
            content: `${q.context} ${q.question}`,
            phase: 5,
            phaseLabel: q.abilityDimension,
            timestamp: new Date().toISOString(),
          },
          {
            id: `aq_stu_${q.id}_${Date.now()}`,
            role: 'student' as const,
            content: reasoning ? `${chosenOpt} (Reasoning: ${reasoning})` : chosenOpt,
            timestamp: new Date().toISOString(),
          },
        ];
      });

      setAssessment(res.assessment);
      onAssessmentComplete(res.assessment, qaMessages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to evaluate answers right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingQuestions) {
    return (
      <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-12 text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#F4A62A] mx-auto" />
        <h2 className="text-lg font-display font-bold text-[#F0D9B5]">
          Preparing AI Ability Questions for {profile.fullName}
        </h2>
        <p className="text-sm text-[#D6C7DF] max-w-md mx-auto leading-relaxed">
          Tailoring 5 direct diagnostic questions to evaluate your reasoning, {(profile.topSubjects?.[0] || profile.academicStream)} mastery, problem solving, and judgment.
        </p>
      </div>
    );
  }

  if (assessment) {
    return (
      <div className="space-y-6">
        <section className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 sm:p-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#6A5ACD]/35 pb-6">
            <div>
              <div className="text-xs font-mono font-medium text-[#F4A62A]">
                Direct AI Ability Check Complete
              </div>
              <h2 className="mt-1.5 text-2xl font-display font-bold text-[#F0D9B5]">
                Ability Assessment Breakdown
              </h2>
              <p className="mt-2 text-sm text-[#D6C7DF] leading-relaxed max-w-2xl">
                {assessment.summary}
              </p>
            </div>

            <div className="shrink-0 rounded-2xl border border-[#6A5ACD]/45 bg-[#1A1A1F] px-6 py-4 text-center">
              <div className="text-xs font-medium text-[#D6C7DF]">Ability Score</div>
              <div className="mt-1 text-3xl font-bold font-mono tabular-nums text-[#F4A62A]">
                {assessment.overallScore}/100
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={loadNewQuestions}
              className="inline-flex items-center gap-2 rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-4 py-2 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/25 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ask Fresh Question Set</span>
            </button>

            <button
              type="button"
              onClick={onGenerateRecommendations}
              disabled={generatingRecs}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {generatingRecs ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>Rank Career Matches</span>
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(assessment.questionBreakdown || []).map((item, idx) => (
            <div
              key={item.questionId}
              className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-medium text-[#A678B9]">
                  Question 0{idx + 1}
                </span>
                <span className="font-mono tabular-nums text-sm font-bold text-[#F4A62A]">
                  {item.score}/100
                </span>
              </div>
              <h3 className="text-sm font-display font-bold text-[#F0D9B5]">
                {item.abilityDimension}
              </h3>
              <div className="h-1.5 w-full rounded-full bg-[#1A1A1F] overflow-hidden">
                <div
                  className="h-full bg-[#F4A62A] rounded-full"
                  style={{ width: `${Math.min(100, Math.max(8, item.score))}%` }}
                />
              </div>
              <p className="text-xs text-[#D6C7DF] leading-relaxed">{item.feedback}</p>
            </div>
          ))}
        </section>

        {Array.isArray(assessment.strengthsSummary) && assessment.strengthsSummary.length > 0 && (
          <section className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Award className="w-4 h-4" />
              <span>Top Demonstrated Strengths:</span>
              <span className="text-[#F0D9B5] font-normal">
                {assessment.strengthsSummary.join(' · ')}
              </span>
            </div>
            <button
              type="button"
              onClick={onGenerateRecommendations}
              disabled={generatingRecs}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors whitespace-nowrap"
            >
              <span>View Career Matches</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl overflow-hidden shadow-[0_24px_48px_rgba(12,11,22,0.55)]">
      {/* Top Question Header & Stepper */}
      <div className="px-6 py-4 border-b border-[#6A5ACD]/35 bg-[#1A1A1F]/65 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <ClipboardCheck className="w-4 h-4 text-[#F4A62A] shrink-0" />
          <div>
            <div className="text-xs font-mono font-medium text-[#F4A62A]">
              AI Ability Questions · {answeredCount} of {questions.length} Answered
            </div>
            <div className="text-xs text-[#D6C7DF]">
              Answer 5 targeted AI questions directly — no live interview required
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {questions.map((q, idx) => {
            const isAnswered =
              answers[q.id] !== undefined && answers[q.id].selectedOptionIndex >= 0;
            const isCurrent = idx === activeIdx;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`w-8 h-8 rounded-lg font-mono tabular-nums text-xs font-semibold transition-colors ${
                  isCurrent
                    ? 'bg-[#F4A62A] text-[#1A1A1F]'
                    : isAnswered
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-[#1A1A1F] text-[#D6C7DF] border border-[#6A5ACD]/45 hover:border-[#A678B9]'
                }`}
              >
                0{idx + 1}
              </button>
            );
          })}
          <button
            type="button"
            onClick={loadNewQuestions}
            title="Refresh question set"
            className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-[#6A5ACD]/50 bg-[#1A1A1F] px-2.5 py-1.5 text-xs font-medium text-[#F0D9B5] hover:bg-[#6A5ACD]/25 transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Set</span>
          </button>
        </div>
      </div>

      {/* Active Question Content */}
      {currentQuestion ? (
        <div className="p-6 sm:p-7 space-y-5">
          <div className="rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] p-4 space-y-1.5">
            <div className="text-xs font-mono font-medium text-[#F4A62A]">
              Checking: {currentQuestion.abilityDimension}
            </div>
            <p className="text-sm text-[#D6C7DF] leading-relaxed">{currentQuestion.context}</p>
          </div>

          <h2 className="text-lg font-display font-bold text-[#F0D9B5] leading-snug">
            {activeIdx + 1}. {currentQuestion.question}
          </h2>

          <div className="space-y-2.5">
            {currentQuestion.options.map((option, optIdx) => {
              const selected = answers[currentQuestion.id]?.selectedOptionIndex === optIdx;
              return (
                <button
                  key={optIdx}
                  type="button"
                  onClick={() => updateSelection(currentQuestion.id, optIdx)}
                  className={`w-full text-left flex items-start gap-3 rounded-xl border p-4 text-xs sm:text-sm transition-colors ${
                    selected
                      ? 'border-[#F4A62A] bg-[#F4A62A]/15 text-[#F0D9B5] font-medium'
                      : 'border-[#6A5ACD]/40 bg-[#1A1A1F] text-[#D6C7DF] hover:bg-[#222042] hover:border-[#A678B9]/65'
                  }`}
                >
                  <span
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selected ? 'border-[#F4A62A] bg-[#F4A62A] text-[#1A1A1F]' : 'border-[#A678B9]/60'
                    }`}
                  >
                    {selected && <CheckCircle2 className="w-3 h-3" />}
                  </span>
                  <span className="leading-relaxed">{option}</span>
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#D6C7DF] mb-1.5">
              Optional: Brief Reasoning Note (helps AI refine your ability score)
            </label>
            <textarea
              rows={2}
              value={answers[currentQuestion.id]?.writtenExplanation || ''}
              onChange={(e) => updateExplanation(currentQuestion.id, e.target.value)}
              placeholder="Explain why you chose this approach in 1–2 sentences..."
              className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A] transition-colors"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-2.5 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-[#6A5ACD]/35 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
              disabled={activeIdx === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-4 py-2 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/25 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-2.5">
              {activeIdx < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveIdx((i) => Math.min(questions.length - 1, i + 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4A62A] px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors whitespace-nowrap"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitAll}
                  disabled={!allAnswered || submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {submitting
                      ? 'Evaluating Abilities...'
                      : allAnswered
                        ? 'Evaluate My Abilities'
                        : `Answer Remaining (${questions.length - answeredCount})`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-[#D6C7DF]">
          <button
            type="button"
            onClick={loadNewQuestions}
            className="rounded-xl bg-[#F4A62A] px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C]"
          >
            Load AI Ability Questions
          </button>
        </div>
      )}
    </div>
  );
};
