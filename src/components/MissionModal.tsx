import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  HelpCircle,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import { evaluateMissionSubmission } from '../api/client';
import type { CareerMission, MissionEvaluationResult } from '../types';

interface MissionModalProps {
  careerId: string;
  mission: CareerMission;
  existingResult?: MissionEvaluationResult;
  onClose: () => void;
  onMissionEvaluated: (result: MissionEvaluationResult) => void;
}

export const MissionModal: React.FC<MissionModalProps> = ({
  careerId,
  mission,
  existingResult,
  onClose,
  onMissionEvaluated,
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(
    mission.multipleChoiceQuestion ? null : 0
  );
  const [writtenResponse, setWrittenResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MissionEvaluationResult | null>(existingResult || null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mission.multipleChoiceQuestion && selectedOption === null) {
      setError('Please select one option for the situational check before submitting.');
      return;
    }
    if (writtenResponse.trim().length < 15) {
      setError('Please write a concise response (at least a couple of sentences) so the AI can evaluate your reasoning.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await evaluateMissionSubmission({
        careerId,
        mission,
        selectedOptionIndex: selectedOption,
        writtenResponse,
      });
      setResult(res);
      onMissionEvaluated(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1F]/85 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-[#2D2B55] border border-[#6A5ACD]/55 border-t-[#A678B9]/55 shadow-[0_32px_80px_rgba(12,11,22,0.8)] overflow-hidden my-8">
        <div className="flex items-start justify-between gap-4 border-b border-[#6A5ACD]/35 px-6 py-5 bg-[#1A1A1F]/70">
          <div>
            <div className="text-xs font-mono font-medium text-[#F4A62A]">
              {mission.locationLabel}
            </div>
            <h2 className="mt-1 text-lg font-display font-bold text-[#F0D9B5]">{mission.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mission dialog"
            className="rounded-xl p-1.5 text-[#D6C7DF] hover:bg-[#6A5ACD]/25 hover:text-[#F0D9B5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] p-4">
            <div className="text-xs font-mono font-medium text-[#A678B9]">
              Scenario Briefing
            </div>
            <p className="mt-1.5 text-sm text-[#D6C7DF] leading-relaxed">{mission.scenarioContext}</p>
          </div>

          <div>
            <div className="text-xs font-mono font-medium text-[#A678B9]">
              Interactive Task
            </div>
            <p className="mt-1.5 text-sm text-[#F0D9B5] font-medium leading-relaxed">{mission.taskPrompt}</p>
          </div>

          {result && (
            <div
              className={`rounded-xl border p-5 space-y-3 ${
                result.passed
                  ? 'border-emerald-500/40 bg-emerald-500/12'
                  : 'border-[#F4A62A]/50 bg-[#F4A62A]/12'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {result.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-[#F4A62A]" />
                  )}
                  <span className="text-sm font-display font-bold text-[#F0D9B5]">
                    {result.passed
                      ? mission.isJobOfferGate
                        ? 'Job Offer Granted — Workplace Stage Unlocked'
                        : 'Mission Completed — Next Stage Unlocked'
                      : mission.isJobOfferGate
                        ? 'Not Selected Yet — Improve Skills & Retry Interview'
                        : 'Needs Improvement — Hints & Learning Support'}
                  </span>
                </div>
                <span className="text-sm font-bold font-mono tabular-nums text-[#F4A62A]">
                  {result.score}/100
                </span>
              </div>

              <p className="text-sm text-[#F0D9B5] leading-relaxed">{result.feedback}</p>

              {result.passed ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 pt-1">
                  <Award className="w-4 h-4" />
                  <span>
                    Skills earned:{' '}
                    {Object.entries(result.skillDeltas)
                      .map(([k, v]) => `+${v} ${k}`)
                      .join(' · ')}
                  </span>
                </div>
              ) : (
                <div className="space-y-2.5 pt-3 border-t border-[#F4A62A]/35">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#F4A62A]">
                    <HelpCircle className="w-4 h-4" />
                    <span>Hints & Learning Support</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-[#F0D9B5]">
                    {result.hints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-[#D6C7DF] bg-[#1A1A1F] rounded-xl p-3 border border-[#F4A62A]/35">
                    {result.learningSupport}
                  </p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mission.multipleChoiceQuestion && (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-[#F0D9B5]">
                  {mission.multipleChoiceQuestion.question}
                </div>
                <div className="space-y-2">
                  {mission.multipleChoiceQuestion.options.map((opt, idx) => (
                    <label
                      key={idx}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs cursor-pointer transition-colors ${
                        selectedOption === idx
                          ? 'border-[#F4A62A] bg-[#F4A62A]/15 text-[#F0D9B5] font-medium'
                          : 'border-[#6A5ACD]/40 bg-[#1A1A1F] text-[#D6C7DF] hover:bg-[#222042]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mission-mc"
                        checked={selectedOption === idx}
                        onChange={() => setSelectedOption(idx)}
                        className="mt-0.5 accent-[#F4A62A]"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">
                Your Action Plan / Simulation Response
              </label>
              <textarea
                rows={4}
                value={writtenResponse}
                onChange={(e) => setWrittenResponse(e.target.value)}
                placeholder="Write your concrete plan, trade-offs, and verification metric..."
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A] transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/60 px-3.5 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#6A5ACD]/35">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-4 py-2 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/25 transition-colors"
              >
                {result?.passed ? 'Continue Exploring' : 'Close'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-5 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-60 transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : result && !result.passed ? (
                  <RotateCcw className="w-3.5 h-3.5" />
                ) : null}
                <span>
                  {submitting
                    ? 'AI Evaluating...'
                    : result && !result.passed
                      ? 'Resubmit & Retry'
                      : 'Submit for AI Evaluation'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
