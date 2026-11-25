import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  GitCompare,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { askExploreMentor } from '../api/client';
import { CAREER_CATALOG, CAREER_CATEGORIES } from '../data/careers';
import type { CareerDefinition, CareerRecommendation, StudentProfile } from '../types';

interface CareerExplorerProps {
  profile?: StudentProfile | null;
  catalogCareers?: CareerDefinition[];
  recommendations: CareerRecommendation[];
  selectedCareerId: string | null;
  compareCareerIds: string[];
  onToggleCompare: (careerId: string) => void;
  onSelectCareer: (careerId: string) => Promise<void>;
  onRefreshRecommendations: () => Promise<void>;
  loadingAction: boolean;
}

interface ExploreMentorTurn {
  id: string;
  role: 'student' | 'mentor';
  content: string;
}

const MENTOR_PROMPTS = [
  'Compare entrance exams & study years for my top matches',
  'Which career offers the strongest 10-year growth & salary?',
  'What skills should I focus on right after 12th grade?',
];

export const CareerExplorer: React.FC<CareerExplorerProps> = ({
  profile = null,
  catalogCareers,
  recommendations,
  selectedCareerId,
  compareCareerIds,
  onToggleCompare,
  onSelectCareer,
  onRefreshRecommendations,
  loadingAction,
}) => {
  const [viewMode, setViewMode] = useState<'ranked' | 'compare' | 'all'>('ranked');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [confirmCareerId, setConfirmCareerId] = useState<string | null>(null);

  // Integrated Conversational AI Career Mentor
  const [mentorOpen, setMentorOpen] = useState(false);
  const [mentorInput, setMentorInput] = useState('');
  const [mentorBusy, setMentorBusy] = useState(false);
  const [focusedCareerId, setFocusedCareerId] = useState<string | null>(null);
  const [mentorTurns, setMentorTurns] = useState<ExploreMentorTurn[]>([
    {
      id: 'init-mentor',
      role: 'mentor',
      content:
        'Hi! Ask me to compare any of your recommended careers, explain entrance exams after 12th, break down studying years, or forecast job demand.',
    },
  ]);

  const activeCatalog = catalogCareers?.length ? catalogCareers : CAREER_CATALOG;
  const recMap = new Map(recommendations.map((r) => [r.careerId, r]));

  const baseCareers =
    viewMode === 'ranked' && recommendations.length > 0
      ? recommendations
          .map((r) => ({ career: activeCatalog.find((c) => c.id === r.careerId)!, rec: r }))
          .filter((item) => Boolean(item.career))
      : activeCatalog.map((career) => ({ career, rec: recMap.get(career.id) }));

  const sortedCareers = (
    selectedCategory === 'All'
      ? baseCareers
      : baseCareers.filter((item) => item.career.domain === selectedCategory)
  ).slice().sort((a, b) => (b.rec?.matchScore ?? 0) - (a.rec?.matchScore ?? 0));

  const comparedCareers = activeCatalog.filter((c) => compareCareerIds.includes(c.id));
  const pendingCareer = confirmCareerId
    ? activeCatalog.find((c) => c.id === confirmCareerId) || null
    : null;

  const sendMentorQuestion = async (questionText: string, careerFocus?: string | null) => {
    const clean = questionText.trim();
    if (!clean || mentorBusy) return;
    setMentorOpen(true);
    if (careerFocus) setFocusedCareerId(careerFocus);
    setMentorInput('');
    const stuTurn: ExploreMentorTurn = {
      id: `m_s_${Date.now()}`,
      role: 'student',
      content: clean,
    };
    setMentorTurns((prev) => [...prev, stuTurn]);
    setMentorBusy(true);
    try {
      const res = await askExploreMentor({
        question: clean,
        profile,
        comparedCareerIds: compareCareerIds,
        focusedCareerId: careerFocus ?? focusedCareerId ?? recommendations[0]?.careerId ?? null,
      });
      setMentorTurns((prev) => [
        ...prev,
        { id: `m_a_${Date.now() + 1}`, role: 'mentor', content: res.reply },
      ]);
    } catch (err) {
      setMentorTurns((prev) => [
        ...prev,
        {
          id: `m_e_${Date.now() + 1}`,
          role: 'mentor',
          content: err instanceof Error ? err.message : 'Unable to reach AI Career Mentor right now.',
        },
      ]);
    } finally {
      setMentorBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#6A5ACD]/35 pb-6">
        <div>
          <div className="text-xs font-mono font-medium text-[#F4A62A]">
            Career Recommendations · Compatibility Ranking · Conversational AI Mentor
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-display font-bold text-[#F0D9B5] text-balance">
            Explore Ranked Careers &amp; Choose Your Journey
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('ranked')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                viewMode === 'ranked'
                  ? 'bg-[#F4A62A] text-[#1A1A1F]'
                  : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
              }`}
            >
              AI Ranked ({recommendations.length || activeCatalog.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compare')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                viewMode === 'compare'
                  ? 'bg-[#F4A62A] text-[#1A1A1F]'
                  : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
              }`}
            >
              Compare ({compareCareerIds.length}/3)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                viewMode === 'all'
                  ? 'bg-[#F4A62A] text-[#1A1A1F]'
                  : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
              }`}
            >
              All Pathways ({activeCatalog.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMentorOpen((o) => !o)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              mentorOpen
                ? 'border-[#F4A62A] bg-[#F4A62A] text-[#1A1A1F]'
                : 'border-[#A678B9]/60 bg-[#2D2B55] text-[#F0D9B5] hover:border-[#F4A62A]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Ask AI Mentor</span>
          </button>

          <button
            type="button"
            onClick={onRefreshRecommendations}
            disabled={loadingAction}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#6A5ACD]/55 bg-[#2D2B55] px-3.5 py-2 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/30 transition-colors whitespace-nowrap shrink-0"
          >
            {loadingAction ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F4A62A]" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[#F4A62A]" />
            )}
            <span>Re-Rank Matches</span>
          </button>
        </div>
      </div>

      {/* Integrated AI Career Mentor Panel */}
      {mentorOpen && (
        <section className="rounded-2xl border border-[#A678B9]/55 bg-[#2D2B55] p-5 space-y-4 shadow-[0_20px_50px_rgba(12,11,22,0.45)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#6A5ACD]/35 pb-3">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-[#F4A62A]" />
              <div>
                <h2 className="text-sm font-display font-bold text-[#F0D9B5]">
                  VECTORA Conversational AI Career Mentor
                </h2>
                <p className="text-[11px] text-[#D6C7DF]">
                  Compare careers, entrance exams, study duration, salary outlook, and skills required.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMentorOpen(false)}
              className="rounded-lg p-1 text-[#D6C7DF] hover:text-[#F0D9B5]"
              aria-label="Close AI Career Mentor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2.5 rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-3.5 text-xs">
            {mentorTurns.map((t) => (
              <div
                key={t.id}
                className={`rounded-xl px-3.5 py-2.5 leading-relaxed ${
                  t.role === 'student'
                    ? 'bg-[#F4A62A] text-[#1A1A1F] font-medium ml-10'
                    : 'bg-[#2D2B55] text-[#F0D9B5] border border-[#6A5ACD]/40 mr-8'
                }`}
              >
                {t.content}
              </div>
            ))}
            {mentorBusy && (
              <div className="flex items-center gap-2 text-[#D6C7DF] px-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F4A62A]" />
                <span>Analyzing career data...</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {MENTOR_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={mentorBusy}
                onClick={() => sendMentorQuestion(q)}
                className="rounded-lg border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-1.5 text-[11px] text-[#D6C7DF] hover:border-[#F4A62A] hover:text-[#F0D9B5] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMentorQuestion(mentorInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={mentorInput}
              onChange={(e) => setMentorInput(e.target.value)}
              placeholder="Ask anything about careers, exams, college years, or future scope..."
              className="flex-1 rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2 text-xs text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-1 focus:ring-[#F4A62A]"
            />
            <button
              type="submit"
              disabled={mentorBusy || !mentorInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </form>
        </section>
      )}

      {/* 8 Career Category Filters */}
      {viewMode !== 'compare' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
              selectedCategory === 'All'
                ? 'bg-[#F4A62A] text-[#1A1A1F] border-[#F4A62A]'
                : 'bg-[#2D2B55] text-[#D6C7DF] border-[#6A5ACD]/45 hover:text-[#F0D9B5]'
            }`}
          >
            All Categories
          </button>
          {CAREER_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                selectedCategory === category
                  ? 'bg-[#6A5ACD] text-[#F0D9B5] border-[#A678B9]'
                  : 'bg-[#2D2B55] text-[#D6C7DF] border-[#6A5ACD]/45 hover:border-[#A678B9] hover:text-[#F0D9B5]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Career Selection Confirmation Gate */}
      {pendingCareer && (
        <div className="rounded-2xl border border-[#F4A62A]/60 bg-[#2D2B55] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_20px_50px_rgba(244,166,42,0.12)]">
          <div>
            <div className="text-xs font-mono font-medium text-[#F4A62A]">
              Confirm Career Selection
            </div>
            <h2 className="mt-1 text-lg font-display font-bold text-[#F0D9B5]">
              Choose {pendingCareer.title} and generate your animated 12th-to-job video journey?
            </h2>
            <p className="mt-1 text-sm text-[#D6C7DF]">
              Generates your 6-level career roadmap and automatically launches animated educational video sessions from 12th pass through qualifying exams, studying years, and real job life.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmCareerId(null)}
              disabled={loadingAction}
              className="rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-4 py-2.5 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/25 transition-colors whitespace-nowrap"
            >
              No, Keep Exploring
            </button>
            <button
              type="button"
              onClick={async () => {
                await onSelectCareer(pendingCareer.id);
                setConfirmCareerId(null);
              }}
              disabled={loadingAction}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {loadingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>Yes, Launch Roadmap &amp; Animated Videos</span>
            </button>
          </div>
        </div>
      )}

      {viewMode === 'compare' ? (
        <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl overflow-hidden">
          {comparedCareers.length < 2 ? (
            <div className="p-14 text-center">
              <GitCompare className="w-8 h-8 text-[#A678B9] mx-auto" />
              <h2 className="mt-3 text-base font-display font-bold text-[#F0D9B5]">
                Select 2 or 3 careers to compare side by side
              </h2>
              <p className="mt-1 text-sm text-[#D6C7DF]">
                Click Compare on any career in AI Ranked or All Pathways.
              </p>
              <button
                type="button"
                onClick={() => setViewMode('ranked')}
                className="mt-5 rounded-xl bg-[#F4A62A] px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors"
              >
                Browse Ranked Careers
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#6A5ACD]/40 bg-[#1A1A1F]/70">
                    <th className="p-5 font-mono text-xs font-medium text-[#D6C7DF] w-48">
                      Dimension
                    </th>
                    {comparedCareers.map((c) => {
                      const rec = recMap.get(c.id);
                      return (
                        <th key={c.id} className="p-5 align-top min-w-[240px]">
                          <div className="text-xs font-mono font-medium text-[#F4A62A]">
                            {c.domain} {rec ? `· ${rec.matchScore}% Match` : ''}
                          </div>
                          <div className="mt-1 text-base font-display font-bold text-[#F0D9B5]">{c.title}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#6A5ACD]/30 text-xs leading-relaxed">
                  <tr>
                    <td className="p-5 font-semibold text-[#F0D9B5]">12th Eligibility</td>
                    {comparedCareers.map((c) => (
                      <td key={c.id} className="p-5 text-[#D6C7DF]">{c.eligibility12th}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-5 font-semibold text-[#F0D9B5]">Entrance Exams</td>
                    {comparedCareers.map((c) => (
                      <td key={c.id} className="p-5 text-[#F0D9B5] font-medium">{c.entranceExams.join(' · ')}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-5 font-semibold text-[#F0D9B5]">College Degrees</td>
                    {comparedCareers.map((c) => (
                      <td key={c.id} className="p-5 text-[#D6C7DF]">{c.recommendedCourses.join(' / ')}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-5 font-semibold text-[#F0D9B5]">Required Skills</td>
                    {comparedCareers.map((c) => (
                      <td key={c.id} className="p-5 text-[#D6C7DF]">
                        <div className="space-y-1.5 font-mono tabular-nums">
                          {Object.entries(c.requiredSkills).map(([sk, val]) => (
                            <div key={sk} className="flex justify-between gap-4">
                              <span className="font-sans text-[#D6C7DF]">{sk}</span>
                              <span className="font-semibold text-[#F4A62A]">{val}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-5 font-semibold text-[#F0D9B5]">Daily Reality</td>
                    {comparedCareers.map((c) => (
                      <td key={c.id} className="p-5 text-[#D6C7DF]">{c.dailySimulationContext}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-5 font-semibold text-[#F0D9B5]">Compensation &amp; Outlook</td>
                    {comparedCareers.map((c) => (
                      <td key={c.id} className="p-5 text-[#F0D9B5]">
                        <div className="font-semibold">{c.salaryBand}</div>
                        <div className="text-emerald-400 mt-0.5">{c.growthOutlook}</div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-5 font-semibold text-[#F0D9B5]">Action</td>
                    {comparedCareers.map((c) => (
                      <td key={c.id} className="p-5">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmCareerId(c.id)}
                            className="rounded-lg bg-[#F4A62A] px-3.5 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors"
                          >
                            Select Career
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleCompare(c.id)}
                            className="rounded-lg border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3 py-2 text-xs font-medium text-[#D6C7DF] hover:bg-[#6A5ACD]/25 hover:text-[#F0D9B5] transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedCareers.length === 0 ? (
            <div className="md:col-span-2 rounded-2xl border border-[#6A5ACD]/45 bg-[#2D2B55] p-10 text-center space-y-3">
              <p className="text-sm text-[#D6C7DF]">
                No careers in <span className="text-[#F0D9B5] font-semibold">{selectedCategory}</span> match the current filter view.
              </p>
              <button
                type="button"
                onClick={() => {
                  setViewMode('all');
                  setSelectedCategory('All');
                }}
                className="rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors"
              >
                Show All Pathways
              </button>
            </div>
          ) : (
            sortedCareers.map(({ career, rec }) => {
              const isSelected = selectedCareerId === career.id;
              const isCompared = compareCareerIds.includes(career.id);
              const isHighCompatibility = (rec?.matchScore ?? 0) >= 80;
              return (
                <article
                  key={career.id}
                  className={`bg-[#2D2B55] border rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'border-[#F4A62A] ring-1 ring-[#F4A62A]/50 shadow-[0_20px_50px_rgba(244,166,42,0.14)]'
                      : 'border-[#6A5ACD]/45 border-t-[#A678B9]/45 hover:border-[#A678B9]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-medium text-[#A678B9]">
                          <span>
                            {rec ? `Rank 0${rec.rank} · ` : ''}
                            {career.domain}
                          </span>
                          {rec && (
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                                isHighCompatibility
                                  ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300'
                                  : 'border-[#F4A62A]/45 bg-[#F4A62A]/12 text-[#F4A62A]'
                              }`}
                            >
                              {isHighCompatibility ? 'High compatibility' : 'Moderate compatibility'}
                            </span>
                          )}
                        </div>
                        <h2 className="mt-1.5 text-xl font-display font-bold text-[#F0D9B5]">
                          {career.title}
                        </h2>
                      </div>
                      {rec && (
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-bold font-mono tabular-nums text-[#F4A62A]">
                            {rec.matchScore}%
                          </div>
                          <div className="text-xs text-[#D6C7DF]">Match</div>
                        </div>
                      )}
                    </div>

                    {rec && (
                      <div className="mt-3 h-1.5 w-full rounded-full bg-[#1A1A1F] overflow-hidden">
                        <div
                          className="h-full bg-[#F4A62A] rounded-full"
                          style={{ width: `${Math.min(100, Math.max(10, rec.matchScore))}%` }}
                        />
                      </div>
                    )}

                    <p className="mt-3.5 text-sm text-[#F0D9B5] font-medium leading-relaxed">
                      {career.tagline}
                    </p>
                    <p className="mt-1.5 text-xs text-[#D6C7DF] leading-relaxed">
                      {career.description}
                    </p>

                    {rec && (
                      <div className="mt-4 pt-4 border-t border-[#6A5ACD]/35 space-y-2">
                        <div className="text-xs font-semibold text-[#F0D9B5]">
                          Why this fits your interview &amp; academic profile
                        </div>
                        <ul className="space-y-1.5 text-xs text-[#D6C7DF]">
                          {rec.reasons.map((reason, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-[#6A5ACD]/35 space-y-3 text-xs">
                      <div>
                        <span className="text-[#A678B9] font-medium block mb-1.5">
                          Required Skills
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.keys(career.requiredSkills).map((skill) => (
                            <span
                              key={skill}
                              className="rounded-md border border-[#6A5ACD]/45 bg-[#1A1A1F] px-2.5 py-1 text-[11px] text-[#F0D9B5]"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="text-[#D6C7DF] block">12th Eligibility &amp; Degree</span>
                          <span className="font-semibold text-[#F0D9B5] mt-0.5 block">
                            {career.eligibility12th} · {career.recommendedCourses[0]}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#D6C7DF] block">Entrance Exams</span>
                          <span className="font-semibold text-[#F0D9B5] mt-0.5 block">
                            {career.entranceExams.join(' · ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#D6C7DF] block">Future Opportunities</span>
                          <span className="font-semibold text-[#F0D9B5] mt-0.5 block">
                            {career.workplaceRoles.join(' · ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#D6C7DF] block">Compensation &amp; Growth</span>
                          <span className="font-semibold text-emerald-300 mt-0.5 block">
                            {career.salaryBand.split('/')[0]} · {career.growthOutlook}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#6A5ACD]/35 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleCompare(career.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                          isCompared
                            ? 'border-[#A678B9] bg-[#6A5ACD]/30 text-[#F0D9B5]'
                            : 'border-[#6A5ACD]/55 bg-[#1A1A1F] text-[#D6C7DF] hover:bg-[#6A5ACD]/25 hover:text-[#F0D9B5]'
                        }`}
                      >
                        {isCompared ? <Check className="w-3.5 h-3.5" /> : <GitCompare className="w-3.5 h-3.5" />}
                        <span>{isCompared ? 'Added' : 'Compare'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          sendMentorQuestion(
                            `Tell me about the 12th-to-job timeline, entrance exams, and daily work for ${career.title}.`,
                            career.id
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3 py-2 text-xs font-semibold text-[#D6C7DF] hover:border-[#F4A62A] hover:text-[#F0D9B5] transition-colors whitespace-nowrap"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#A678B9]" />
                        <span>Ask AI</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmCareerId(career.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors whitespace-nowrap"
                    >
                      <span>{isSelected ? 'Active Career · View' : 'Select Career'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

