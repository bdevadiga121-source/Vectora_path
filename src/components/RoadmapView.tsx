import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Film,
  Play,
  RefreshCw,
} from 'lucide-react';
import { CareerVideoJourney } from './CareerVideoJourney';
import { CareerVideoStudio } from './CareerVideoStudio';
import type {
  CareerDefinition,
  CareerMission,
  MissionEvaluationResult,
  RoadmapStage,
  StudentProfile,
} from '../types';

interface RoadmapViewProps {
  career: CareerDefinition;
  profile: StudentProfile | null;
  roadmap: RoadmapStage[];
  completedMissionIds: string[];
  watchedVideoSessionIds: string[];
  missionResults: Record<string, MissionEvaluationResult>;
  onToggleMilestone: (stageId: string, milestoneId: string) => void;
  onMarkSessionWatched: (watchId: string) => void;
  onLaunchMission: (mission: CareerMission, stage: RoadmapStage) => void;
  onEnter3DWorld: (buildingId?: string) => void;
  onExploreAlternatives: () => void;
}

const STAGE_TO_VIDEO_KEY: Record<number, string> = {
  1: 'after-12th',
  2: 'entrance-exams',
  3: 'college-years',
  4: 'skills-internships',
  5: 'daily-job',
  6: 'future-scope',
};

export const RoadmapView: React.FC<RoadmapViewProps> = ({
  career,
  profile,
  roadmap,
  completedMissionIds,
  watchedVideoSessionIds,
  missionResults,
  onToggleMilestone,
  onMarkSessionWatched,
  onLaunchMission,
  onEnter3DWorld,
  onExploreAlternatives,
}) => {
  const [selectedVideoKey, setSelectedVideoKey] = useState<string>('after-12th');
  const [showCustomStudio, setShowCustomStudio] = useState(false);
  const videoSectionRef = useRef<HTMLDivElement>(null);

  const totalMissions = roadmap.reduce((acc, st) => acc + st.missions.length, 0);
  const completedCount = roadmap.reduce(
    (acc, st) => acc + st.missions.filter((m) => completedMissionIds.includes(m.id)).length,
    0
  );

  const jumpToStageVideo = (stageNumber: number) => {
    const key = STAGE_TO_VIDEO_KEY[stageNumber] || 'after-12th';
    setSelectedVideoKey(key);
    videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
      {/* Editorial Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 border-b border-[#6A5ACD]/35 pb-6">
        <div>
          <div className="text-xs font-mono font-medium text-[#F4A62A]">
            Personalized 6-Level Career Roadmap · {career.domain}
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-4xl font-display font-bold text-[#F0D9B5] text-balance">
            {career.title}
          </h1>
          <p className="mt-2 text-sm text-[#D6C7DF] max-w-2xl leading-relaxed">
            Freely explore every stage from 12th pass and qualifying entrance exams to your college studying years, internships, daily job reality, and 10-year future scope—with automatically generated animated journey videos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onExploreAlternatives}
            className="inline-flex items-center gap-2 rounded-xl border border-[#6A5ACD]/55 bg-[#2D2B55] px-4 py-2.5 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/30 transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Change Career</span>
          </button>
          <button
            type="button"
            onClick={() => onEnter3DWorld()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors whitespace-nowrap shadow-[0_0_24px_rgba(244,166,42,0.22)]"
          >
            <Box className="w-4 h-4" />
            <span>Enter 3D Career World</span>
          </button>
        </div>
      </div>

      {/* Unified Architectural Snapshot Bar */}
      <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#6A5ACD]/35">
        <div className="p-5">
          <div className="text-xs font-medium text-[#D6C7DF]">12th Standard Eligibility</div>
          <div className="mt-1.5 text-xs font-medium text-[#F0D9B5] leading-relaxed">
            {career.eligibility12th}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-[#D6C7DF]">Qualifying Entrance Exams</div>
          <div className="mt-1.5 text-xs font-medium text-[#F0D9B5] leading-relaxed">
            {career.entranceExams.join(' · ')}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-[#D6C7DF]">Target Degree Courses</div>
          <div className="mt-1.5 text-xs font-medium text-[#F0D9B5] leading-relaxed">
            {career.recommendedCourses.join(' · ')}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-[#D6C7DF]">Roadmap Progress</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#F4A62A]">
            {completedCount}/{totalMissions}{' '}
            <span className="text-sm font-sans font-semibold text-[#D6C7DF]">Missions</span>
          </div>
        </div>
      </div>

      {/* Automated Animated Career Journey Videos (12th Pass -> Exams -> Study Years -> Job -> Future) */}
      <div ref={videoSectionRef}>
        <CareerVideoJourney
          career={career}
          profile={profile}
          watchedVideoSessionIds={watchedVideoSessionIds}
          onMarkSessionWatched={onMarkSessionWatched}
          initialSessionKey={selectedVideoKey}
          autoGenerateFirstSession={true}
        />
      </div>

      {/* 6-Level Freely Navigable Career Progression */}
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-display font-bold text-[#F0D9B5]">
            6-Level Academic &amp; Career Progression (Freely Navigable)
          </h2>
          <span className="text-xs font-mono tabular-nums text-emerald-400">
            All {roadmap.length} Levels Open · Explore in Any Order
          </span>
        </div>

        <div className="space-y-5">
          {roadmap.map((stage) => {
            const stageDone = stage.missions.every((m) => completedMissionIds.includes(m.id));
            return (
              <section
                key={stage.id}
                className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#6A5ACD]/35 pb-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono tabular-nums text-sm font-bold shrink-0 ${
                        stageDone
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                          : 'bg-[#F4A62A]/15 text-[#F4A62A] border border-[#F4A62A]/45'
                      }`}
                    >
                      0{stage.stageNumber}
                    </div>
                    <div>
                      <div className="text-xs text-[#D6C7DF]">
                        {stage.buildingName} ·{' '}
                        <span
                          className={
                            stageDone
                              ? 'text-emerald-400 font-semibold'
                              : 'text-[#F4A62A] font-semibold'
                          }
                        >
                          {stageDone ? 'Completed' : 'Open to Explore'}
                        </span>
                      </div>
                      <h3 className="mt-0.5 text-lg sm:text-xl font-display font-bold text-[#F0D9B5]">
                        {stage.title}
                      </h3>
                      <p className="mt-1 text-sm text-[#D6C7DF]">{stage.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => jumpToStageVideo(stage.stageNumber)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#F4A62A]/55 bg-[#1A1A1F] px-3.5 py-2 text-xs font-semibold text-[#F4A62A] hover:bg-[#F4A62A]/15 transition-colors whitespace-nowrap"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Watch Stage Video</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEnter3DWorld(stage.buildingId)}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-4 py-2 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/25 transition-colors whitespace-nowrap"
                    >
                      <Box className="w-3.5 h-3.5 text-[#F4A62A]" />
                      <span>Visit {stage.buildingName}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Stage Checkpoints */}
                  <div className="lg:col-span-6 space-y-2">
                    <div className="text-xs font-mono font-medium text-[#A678B9] mb-3">
                      Stage Checkpoints
                    </div>
                    <div className="divide-y divide-[#6A5ACD]/30 border border-[#6A5ACD]/40 rounded-xl overflow-hidden">
                      {stage.milestones.map((ms) => (
                        <button
                          key={ms.id}
                          type="button"
                          onClick={() => onToggleMilestone(stage.id, ms.id)}
                          className="w-full text-left flex items-start gap-3 p-3.5 bg-[#1A1A1F] hover:bg-[#222042] transition-colors"
                        >
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              ms.completed ? 'text-emerald-400' : 'text-[#6A5ACD]'
                            }`}
                          />
                          <div>
                            <div
                              className={`text-xs font-semibold ${
                                ms.completed ? 'text-emerald-300 line-through' : 'text-[#F0D9B5]'
                              }`}
                            >
                              {ms.title}
                            </div>
                            <div className="text-xs text-[#D6C7DF] mt-0.5 leading-relaxed">
                              {ms.detail}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Missions */}
                  <div className="lg:col-span-6 space-y-3">
                    <div className="text-xs font-mono font-medium text-[#A678B9] mb-3">
                      Interactive Missions &amp; Practice
                    </div>
                    {stage.missions.map((mission) => {
                      const isCompleted = completedMissionIds.includes(mission.id);
                      const lastEval = missionResults[mission.id];
                      return (
                        <div
                          key={mission.id}
                          className="rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-4 flex flex-col justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium text-[#A678B9]">{mission.locationLabel}</span>
                              {isCompleted ? (
                                <span className="inline-flex items-center gap-1 font-semibold font-mono tabular-nums text-emerald-400">
                                  <Award className="w-3.5 h-3.5" />
                                  <span>Passed ({lastEval?.score ?? 85}%)</span>
                                </span>
                              ) : lastEval && !lastEval.passed ? (
                                <span className="font-semibold font-mono tabular-nums text-[#F4A62A]">
                                  Needs Retry ({lastEval.score}%)
                                </span>
                              ) : null}
                            </div>
                            <h4 className="mt-1 text-sm font-display font-bold text-[#F0D9B5]">
                              {mission.title}
                            </h4>
                            <p className="mt-1 text-xs text-[#D6C7DF] leading-relaxed">{mission.summary}</p>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#6A5ACD]/35">
                            <span className="text-xs font-mono tabular-nums text-[#D6C7DF]">
                              {Object.entries(mission.skillRewards)
                                .map(([k, v]) => `+${v} ${k}`)
                                .join(' · ')}
                            </span>
                            <button
                              type="button"
                              onClick={() => onLaunchMission(mission, stage)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F4A62A] px-3.5 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors whitespace-nowrap shrink-0"
                            >
                              {isCompleted ? (
                                <ArrowRight className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {isCompleted
                                  ? 'Review / Replay'
                                  : lastEval && !lastEval.passed
                                    ? 'Improve & Retry'
                                    : 'Start Mission'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Collapsible Custom Scene Video Generator */}
      <div className="rounded-2xl border border-[#6A5ACD]/45 bg-[#2D2B55] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCustomStudio((s) => !s)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#6A5ACD]/15 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Film className="w-4 h-4 text-[#F4A62A]" />
            <div>
              <div className="text-sm font-display font-bold text-[#F0D9B5]">
                Custom Scene Generator (Optional Studio)
              </div>
              <div className="text-xs text-[#D6C7DF]">
                Create custom text-to-video or animate your own project/workspace photo
              </div>
            </div>
          </div>
          {showCustomStudio ? (
            <ChevronUp className="w-4 h-4 text-[#F4A62A]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#A678B9]" />
          )}
        </button>

        {showCustomStudio && (
          <div className="p-4 border-t border-[#6A5ACD]/35">
            <CareerVideoStudio career={career} />
          </div>
        )}
      </div>
    </div>
  );
};

