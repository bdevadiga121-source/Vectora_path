import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  Box,
  CheckCircle2,
  FileText,
  Film,
  GitCompare,
  Loader2,
  Printer,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { analyzeStudentProgress } from '../api/client';
import { CAREER_CATALOG } from '../data/careers';
import type {
  CareerDefinition,
  CareerRecommendation,
  InterviewState,
  ProgressAnalytics,
  RoadmapStage,
} from '../types';

interface ProgressAndPivotProps {
  studentName?: string;
  career: CareerDefinition;
  catalogCareers?: CareerDefinition[];
  interview?: InterviewState;
  recommendations?: CareerRecommendation[];
  roadmap: RoadmapStage[];
  skills: Record<string, number>;
  completedMissionIds: string[];
  watchedVideoSessionIds?: string[];
  completed3DActivityIds?: string[];
  advancedUnlocked: boolean;
  cachedAnalytics: ProgressAnalytics | null;
  onUpdateAnalytics: (analytics: ProgressAnalytics) => void;
  onSatisfiedContinue: () => Promise<void>;
  onPivotCareer: (newCareerId: string) => Promise<void>;
  onEnter3DWorld: () => void;
}

export const ProgressAndPivot: React.FC<ProgressAndPivotProps> = ({
  studentName = 'Student',
  career,
  catalogCareers,
  interview,
  recommendations = [],
  roadmap,
  skills,
  completedMissionIds,
  watchedVideoSessionIds = [],
  completed3DActivityIds = [],
  advancedUnlocked,
  cachedAnalytics,
  onUpdateAnalytics,
  onSatisfiedContinue,
  onPivotCareer,
  onEnter3DWorld,
}) => {
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [compareAltId, setCompareAltId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [lastAnalyzedKey, setLastAnalyzedKey] = useState<string | null>(null);
  const currentAnalysisKey = `${career.id}:${completedMissionIds.length}:${roadmap.length}`;

  useEffect(() => {
    if (cachedAnalytics && lastAnalyzedKey === null) {
      setLastAnalyzedKey(currentAnalysisKey);
      return;
    }
    if (cachedAnalytics && lastAnalyzedKey === currentAnalysisKey) {
      return;
    }
    let active = true;
    setLoading(true);
    analyzeStudentProgress({
      careerId: career.id,
      skills,
      completedMissionIds,
      roadmap,
    })
      .then((res) => {
        if (active) {
          onUpdateAnalytics(res.analytics);
          setLastAnalyzedKey(currentAnalysisKey);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentAnalysisKey]);

  const analytics = cachedAnalytics;
  const activeCatalog = catalogCareers?.length ? catalogCareers : CAREER_CATALOG;
  const alternatives = activeCatalog.filter((c) => c.id !== career.id);
  const comparedAlt = alternatives.find((c) => c.id === compareAltId) || alternatives[0];

  const handleContinueYes = async () => {
    setActionBusy(true);
    setStatusMessage(null);
    try {
      await onSatisfiedContinue();
      setStatusMessage(
        'Advanced Principal Missions unlocked and your Career Roadmap has been updated.'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleSelectAlternative = async (altId: string) => {
    setActionBusy(true);
    try {
      await onPivotCareer(altId);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#6A5ACD]/35 pb-6">
        <div>
          <div className="text-xs font-mono font-medium text-[#F4A62A]">
            Performance Tracking · Strengths & Skill Gaps · Career Satisfaction Check
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-display font-bold text-[#F0D9B5] text-balance">
            Skills Progress & Career Pathway Review
          </h1>
        </div>
        <button
          type="button"
          onClick={onEnter3DWorld}
          className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-4 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors whitespace-nowrap shrink-0"
        >
          <Box className="w-4 h-4" />
          <span>Return to 3D Career World</span>
        </button>
      </div>

      {/* Benchmark Comparison + Diagnostic */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 sm:p-7 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-[#6A5ACD]/35 pb-5">
            <div>
              <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                Progress vs. {career.title} Benchmarks
              </h2>
              <p className="text-xs text-[#D6C7DF] mt-0.5">
                Earned mission skills compared against target career requirements
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-bold font-mono tabular-nums text-[#F4A62A]">
                {analytics ? `${analytics.careerReadinessScore}%` : '--'}
              </div>
              <div className="text-xs font-medium text-[#D6C7DF]">
                Readiness
              </div>
            </div>
          </div>

          {loading && !analytics ? (
            <div className="py-12 flex items-center justify-center gap-2.5 text-xs text-[#D6C7DF]">
              <Loader2 className="w-4 h-4 animate-spin text-[#F4A62A]" />
              <span>AI analyzing mission performance and skill gaps...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {(analytics?.requirementComparison || []).map((row) => {
                const met = row.current >= row.required - 5;
                return (
                  <div key={row.skill}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-[#F0D9B5]">{row.skill}</span>
                      <span className="font-mono tabular-nums text-[#D6C7DF]">
                        <strong className="text-[#F0D9B5]">{row.current}</strong> / {row.required}{' '}
                        <span className={met ? 'text-emerald-400 font-semibold' : 'text-[#F4A62A] font-semibold'}>
                          ({met ? 'On Track' : `-${row.required - row.current} gap`})
                        </span>
                      </span>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-[#1A1A1F] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          met ? 'bg-emerald-400' : 'bg-[#F4A62A]'
                        }`}
                        style={{ width: `${Math.min(100, row.current)}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-[#F0D9B5]"
                        style={{ left: `${Math.min(99, row.required)}%` }}
                        title={`Target: ${row.required}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-2 border-b border-[#6A5ACD]/35 pb-4">
            <TrendingUp className="w-4 h-4 text-[#F4A62A]" />
            <h2 className="text-base font-display font-bold text-[#F0D9B5]">AI Diagnostic Summary</h2>
          </div>

          <p className="text-sm text-[#D6C7DF] leading-relaxed">
            {analytics?.summary || 'Complete missions in the 3D Career World to build your diagnostic profile.'}
          </p>

          <div className="space-y-4 pt-3 border-t border-[#6A5ACD]/35">
            <div>
              <div className="text-xs font-mono font-medium text-emerald-400 mb-2">
                Identified Strengths
              </div>
              <ul className="space-y-1.5 text-xs text-[#D6C7DF]">
                {(analytics?.strengths || ['Analytical Curiosity']).map((st) => (
                  <li key={st} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{st}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-[#6A5ACD]/35">
              <div className="text-xs font-mono font-medium text-[#F4A62A] mb-2">
                Skill Gaps to Close
              </div>
              {analytics?.skillGaps?.length ? (
                <ul className="space-y-1.5 text-xs text-[#D6C7DF]">
                  {analytics.skillGaps.map((gap) => (
                    <li key={gap} className="flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-[#F4A62A] shrink-0" />
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-400 font-medium">
                  No major skill gaps detected for your current target level.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Career Satisfaction Decision Loop */}
      <section className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 sm:p-7 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="text-xs font-mono font-medium text-[#F4A62A]">
              Continuous Career Development Loop
            </div>
            <h2 className="mt-1 text-xl font-display font-bold text-[#F0D9B5]">
              Are you satisfied with pursuing {career.title}?
            </h2>
            <p className="mt-1 text-sm text-[#D6C7DF] max-w-2xl">
              {analytics?.satisfactionRecommendation ||
                'Continue to unlock advanced missions and update your roadmap, or explore and compare alternative careers.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleContinueYes}
              disabled={actionBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-emerald-400 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
              <span>
                {advancedUnlocked
                  ? 'Yes · Continue & View Roadmap'
                  : 'Yes · Unlock Advanced Missions'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowAlternatives((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-5 py-2.5 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/25 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              <span>No · Explore Alternative Careers</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/12 px-4 py-3 text-xs font-semibold text-emerald-300">
            {statusMessage}
          </div>
        )}

        {showAlternatives && (
          <div className="pt-6 border-t border-[#6A5ACD]/35 space-y-6">
            <div>
              <h3 className="text-base font-display font-bold text-[#F0D9B5]">
                Compare Career Requirements & Alternative Pathways
              </h3>
              <p className="text-xs text-[#D6C7DF] mt-0.5">
                Inspect how your current strengths transfer before switching your roadmap and 3D Career World.
              </p>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="rounded-2xl border border-[#6A5ACD]/45 bg-[#1A1A1F] p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F0D9B5] mb-4">
                <GitCompare className="w-4 h-4 text-[#F4A62A]" />
                <span>Current ({career.title}) vs. Alternative ({comparedAlt.title})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-xl p-4 space-y-1.5">
                  <div className="font-bold text-[#F0D9B5]">Current: {career.title}</div>
                  <div className="text-[#D6C7DF]">Exams: {career.entranceExams.join(', ')}</div>
                  <div className="text-[#D6C7DF]">Courses: {career.recommendedCourses[0]}</div>
                  <div className="text-[#D6C7DF]">Outlook: {career.growthOutlook}</div>
                </div>
                <div className="bg-[#2D2B55] border border-[#F4A62A]/60 rounded-xl p-4 space-y-1.5">
                  <div className="font-bold text-[#F4A62A]">Alternative: {comparedAlt.title}</div>
                  <div className="text-[#F0D9B5]">Exams: {comparedAlt.entranceExams.join(', ')}</div>
                  <div className="text-[#F0D9B5]">Courses: {comparedAlt.recommendedCourses[0]}</div>
                  <div className="text-[#F0D9B5]">Outlook: {comparedAlt.growthOutlook}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {alternatives.map((alt) => (
                <div
                  key={alt.id}
                  className="rounded-2xl border border-[#6A5ACD]/45 bg-[#1A1A1F] p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="text-xs font-mono font-medium text-[#A678B9]">
                      {alt.domain}
                    </div>
                    <h4 className="mt-1 text-sm font-display font-bold text-[#F0D9B5]">{alt.title}</h4>
                    <p className="mt-1.5 text-xs text-[#D6C7DF] leading-relaxed">{alt.tagline}</p>
                    <div className="mt-3 text-xs text-[#D6C7DF]">
                      Primary Exam: <span className="text-[#F0D9B5] font-semibold">{alt.entranceExams[0]}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#6A5ACD]/35">
                    <button
                      type="button"
                      onClick={() => setCompareAltId(alt.id)}
                      className="rounded-lg border border-[#6A5ACD]/55 bg-[#2D2B55] px-3 py-1.5 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/30"
                    >
                      Compare
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleSelectAlternative(alt.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#F4A62A] px-3.5 py-1.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-60"
                    >
                      <span>Switch & Enter World</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Complete 8-Section Personalized Career Exploration Report */}
      <section className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#6A5ACD]/35 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F4A62A]/15 border border-[#F4A62A]/45 text-[#F4A62A] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono font-medium text-[#F4A62A]">
                VECTORA Career Report · {studentName}
              </div>
              <h2 className="mt-0.5 text-xl font-display font-bold text-[#F0D9B5]">
                Personalized 8-Section Career Exploration Report
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#6A5ACD]/60 bg-[#1A1A1F] px-4 py-2 text-xs font-semibold text-[#F0D9B5] hover:border-[#F4A62A] hover:text-[#F4A62A] transition-colors whitespace-nowrap shrink-0 print:hidden"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save Report</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* 1. Interview Summary */}
          <div className="rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-4 space-y-2">
            <div className="font-mono font-semibold text-[#F4A62A]">1. Interview Summary</div>
            <p className="text-[#D6C7DF] leading-relaxed">
              {interview?.aiInterviewSummary ||
                interview?.videoInterviewReport?.followUpEvaluation ||
                interview?.abilityAssessment?.summary ||
                `Completed VECTORA AI interview exploring interests (${(interview?.interestsSummary || []).join(', ') || 'Academic Discovery'}).`}
            </p>
          </div>

          {/* 2. Assessment Results */}
          <div className="rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-4 space-y-2">
            <div className="font-mono font-semibold text-[#F4A62A]">2. Assessment Results</div>
            {(interview?.demonstratedAbilities || []).length > 0 ? (
              <div className="space-y-1.5">
                {interview!.demonstratedAbilities.slice(0, 4).map((ab) => (
                  <div key={ab.name} className="flex items-center justify-between text-[#D6C7DF]">
                    <span>{ab.name}</span>
                    <span className="font-mono font-semibold text-[#F0D9B5]">{ab.level}/100</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#D6C7DF]">
                Assessment Score:{' '}
                {interview?.videoInterviewReport?.overallScore ??
                  interview?.abilityAssessment?.overallScore ??
                  analytics?.careerReadinessScore ??
                  '--'}
                /100
              </p>
            )}
          </div>

          {/* 3. Recommended Careers */}
          <div className="rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-4 space-y-2">
            <div className="font-mono font-semibold text-[#F4A62A]">3. Recommended Careers</div>
            {recommendations.length > 0 ? (
              <ul className="space-y-1 text-[#D6C7DF]">
                {recommendations.slice(0, 4).map((r) => {
                  const matched = activeCatalog.find((c) => c.id === r.careerId);
                  return (
                    <li key={r.careerId} className="flex items-center justify-between">
                      <span className="text-[#F0D9B5]">{matched?.title || r.careerId}</span>
                      <span className="font-mono text-[#F4A62A]">{r.matchScore}%</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[#D6C7DF]">Explore Careers ranking ready based on your baseline.</p>
            )}
          </div>

          {/* 4. Selected Career */}
          <div className="rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-4 space-y-2">
            <div className="font-mono font-semibold text-[#F4A62A]">4. Selected Career</div>
            <div className="text-sm font-display font-bold text-[#F0D9B5]">{career.title}</div>
            <p className="text-[#D6C7DF] leading-relaxed">
              {career.domain} · Exams: {career.entranceExams.slice(0, 2).join(', ')} · Degree:{' '}
              {career.recommendedCourses[0]}
            </p>
          </div>

          {/* 5. Roadmap Completion & Animated Videos Watched */}
          <div className="rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-4 space-y-2">
            <div className="font-mono font-semibold text-[#F4A62A] flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" />
              <span>5. Roadmap Completion &amp; Animated Videos Watched</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="rounded-lg bg-[#2D2B55] p-2">
                <div className="font-mono font-bold text-base text-[#F4A62A]">
                  {watchedVideoSessionIds.filter((id) => id.startsWith(`${career.id}:`)).length}/7
                </div>
                <div className="text-[11px] text-[#D6C7DF]">Videos</div>
              </div>
              <div className="rounded-lg bg-[#2D2B55] p-2">
                <div className="font-mono font-bold text-base text-[#F0D9B5]">
                  {completedMissionIds.length}/{roadmap.reduce((s, r) => s + r.missions.length, 0) || 6}
                </div>
                <div className="text-[11px] text-[#D6C7DF]">Missions</div>
              </div>
              <div className="rounded-lg bg-[#2D2B55] p-2">
                <div className="font-mono font-bold text-base text-emerald-400">
                  {completed3DActivityIds.filter((id) => id.startsWith(`${career.id}:`)).length}
                </div>
                <div className="text-[11px] text-[#D6C7DF]">3D Pavilions</div>
              </div>
            </div>
          </div>

          {/* 6. Skills Developed */}
          <div className="rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-4 space-y-2">
            <div className="font-mono font-semibold text-[#F4A62A]">6. Skills Developed</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(skills).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-md border border-[#6A5ACD]/45 bg-[#2D2B55] px-2.5 py-1 text-[11px] text-[#F0D9B5]"
                >
                  {k}: <strong className="text-[#F4A62A]">{v}</strong>
                </span>
              ))}
            </div>
          </div>

          {/* 7. Areas for Improvement */}
          <div className="rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-4 space-y-2">
            <div className="font-mono font-semibold text-[#F4A62A]">7. Areas for Improvement</div>
            <ul className="space-y-1 text-[#D6C7DF]">
              {(analytics?.skillGaps?.length
                ? analytics.skillGaps
                : interview?.areasToImprove?.length
                  ? interview.areasToImprove
                  : ['Keep completing hands-on missions and mock entrance challenges.']
              ).map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <span className="text-[#F4A62A]">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 8. Suggested Next Steps */}
          <div className="rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-4 space-y-2">
            <div className="font-mono font-semibold text-[#F4A62A]">8. Suggested Next Steps</div>
            <p className="text-[#D6C7DF] leading-relaxed">
              {analytics?.satisfactionRecommendation ||
                `Watch all 7 animated journey sessions for ${career.title}, visit every 3D Career World pavilion, and complete your entrance exam readiness checkpoints (${career.entranceExams[0]}).`}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
