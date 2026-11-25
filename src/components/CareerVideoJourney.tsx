import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  Briefcase,
  Captions,
  CheckCircle2,
  Compass,
  Film,
  GraduationCap,
  HelpCircle,
  Layers,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  TrendingUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  askExploreMentor,
  fetchCareerJourneyPlan,
  generateCareerJourneyVideoSession,
  type ApiError,
} from '../api/client';
import type {
  AnimatedSceneBeat,
  AnimatedSceneScript,
  CareerDefinition,
  CareerVideoSessionMedia,
  CareerVideoSessionPlan,
  StudentProfile,
} from '../types';

interface CareerVideoJourneyProps {
  career: CareerDefinition;
  profile: StudentProfile | null;
  watchedVideoSessionIds: string[];
  onMarkSessionWatched: (watchId: string) => void;
  initialSessionKey?: string;
  autoGenerateFirstSession?: boolean;
  compact?: boolean;
}

const SESSION_ORDER = [
  'after-12th',
  'entrance-exams',
  'college-years',
  'skills-internships',
  'daily-job',
  'future-scope',
  'career-overview',
];

const SCENE_SCRIPT_MIME = 'application/vnd.vectora-scene-script+json';

function resolveSceneScript(media?: CareerVideoSessionMedia | null): AnimatedSceneScript | null {
  if (!media) return null;
  if (media.sceneScript && Array.isArray(media.sceneScript.scenes) && media.sceneScript.scenes.length > 0) {
    return media.sceneScript;
  }
  if (media.mimeType === SCENE_SCRIPT_MIME && media.videoDataBase64) {
    try {
      const jsonStr = atob(media.videoDataBase64);
      const parsed = JSON.parse(jsonStr) as AnimatedSceneScript;
      if (parsed && Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
        return parsed;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function formatClock(sec: number): string {
  const whole = Math.max(0, Math.floor(sec));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const SceneMetaphorArtwork: React.FC<{
  metaphor: AnimatedSceneBeat['visualMetaphor'];
  progressRatio: number;
}> = ({ metaphor, progressRatio }) => {
  const barHeights = [38, 62, 78, 94];

  switch (metaphor) {
    case 'gateway':
      return (
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shrink-0">
          <div className="vectra-pulse-ring absolute inset-1 rounded-full border-2 border-[#F4A62A]/45" />
          <div className="vectra-orbit absolute inset-3 rounded-full border border-dashed border-[#A678B9]/65" />
          <div className="vectra-float relative w-16 h-16 rounded-2xl bg-[#2D2B55]/95 border border-[#F4A62A]/65 flex items-center justify-center shadow-[0_0_28px_rgba(244,166,42,0.28)]">
            <GraduationCap className="w-8 h-8 text-[#F4A62A]" />
          </div>
          <span className="absolute -top-1 right-3 w-3 h-3 rounded-full bg-[#F4A62A] shadow-[0_0_12px_#F4A62A]" />
          <span className="absolute bottom-1 left-2 w-2.5 h-2.5 rounded-full bg-[#6A5ACD]" />
        </div>
      );

    case 'exams':
      return (
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl bg-[#2D2B55]/75 border border-[#6A5ACD]/50 p-3 flex flex-col justify-end gap-2 shrink-0">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#F4A62A]">
            <span>EXAM READINESS</span>
            <span>{Math.round(55 + progressRatio * 40)}%</span>
          </div>
          <div className="flex items-end gap-2 h-20 pt-2">
            {barHeights.map((targetH, idx) => {
              const dynamicH = Math.min(100, Math.round(targetH * (0.45 + progressRatio * 0.55)));
              return (
                <div key={idx} className="flex-1 bg-[#1A1A1F] rounded-t-md h-full flex items-end overflow-hidden">
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      idx === 3 ? 'bg-[#F4A62A]' : 'bg-[#6A5ACD]'
                    }`}
                    style={{ height: `${dynamicH}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );

    case 'campus':
      return (
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(166,120,185,0.25)" strokeWidth="2" />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke="#F4A62A"
              strokeWidth="3"
              strokeDasharray="16 8"
              className="vectra-dash-flow"
            />
          </svg>
          <div className="vectra-float absolute w-16 h-16 rounded-2xl bg-[#2D2B55] border border-[#A678B9]/65 flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-[#F0D9B5]" />
          </div>
          <div className="absolute bottom-2 px-2 py-0.5 rounded bg-[#1A1A1F]/90 border border-[#6A5ACD]/50 text-[10px] font-mono text-[#F4A62A]">
            YR 1 → YR 4
          </div>
        </div>
      );

    case 'workshop':
      return (
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shrink-0">
          <div className="vectra-orbit-reverse absolute inset-2 rounded-2xl border border-[#6A5ACD]/45" />
          <div className="vectra-orbit absolute inset-5 rounded-xl border border-[#F4A62A]/45" />
          <div className="vectra-float relative w-14 h-14 rounded-xl bg-[#2D2B55] border border-[#F4A62A]/60 flex items-center justify-center">
            <Layers className="w-7 h-7 text-[#F4A62A]" />
          </div>
        </div>
      );

    case 'office':
      return (
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shrink-0">
          <div className="vectra-pulse-ring absolute inset-2 rounded-2xl border border-[#F4A62A]/45 bg-[#6A5ACD]/15" />
          <div className="vectra-float relative w-16 h-16 rounded-2xl bg-[#2D2B55] border border-[#F4A62A]/65 flex items-center justify-center shadow-[0_0_24px_rgba(106,90,205,0.35)]">
            <Briefcase className="w-8 h-8 text-[#F4A62A]" />
          </div>
        </div>
      );

    case 'horizon':
      return (
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl bg-[#2D2B55]/70 border border-[#A678B9]/45 p-3 flex flex-col justify-between shrink-0 overflow-hidden">
          <div className="text-[10px] font-mono text-[#F4A62A]">10-YR SCOPE</div>
          <svg viewBox="0 0 120 70" className="w-full h-20">
            <path
              d="M8 60 Q 42 50, 68 30 T 114 10"
              fill="none"
              stroke="#F4A62A"
              strokeWidth="3.5"
              strokeDasharray="10 6"
              className="vectra-dash-flow"
            />
            <circle cx="114" cy="10" r="5" fill="#F4A62A" />
          </svg>
          <div className="flex items-center gap-1 text-[10px] text-[#F0D9B5]">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Growth Trajectory</span>
          </div>
        </div>
      );

    default:
      return (
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shrink-0">
          <div className="vectra-orbit absolute inset-1 rounded-full border border-[#6A5ACD]/55" />
          <div className="vectra-orbit-reverse absolute inset-4 rounded-full border border-dashed border-[#F4A62A]/60" />
          <div className="vectra-float relative w-14 h-14 rounded-full bg-[#2D2B55] border border-[#F4A62A]/65 flex items-center justify-center">
            <Compass className="w-7 h-7 text-[#F4A62A]" />
          </div>
        </div>
      );
  }
};

export const CareerVideoJourney: React.FC<CareerVideoJourneyProps> = ({
  career,
  profile,
  watchedVideoSessionIds,
  onMarkSessionWatched,
  initialSessionKey,
  autoGenerateFirstSession = true,
  compact = false,
}) => {
  const [sessions, setSessions] = useState<CareerVideoSessionPlan[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string>(initialSessionKey || 'after-12th');
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [videoErrors, setVideoErrors] = useState<Record<string, { message: string; retryAfterSec?: number }>>({});

  // Playback, TTS / Web Speech narration, subtitles & speed
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [videoTimeSec, setVideoTimeSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.25>(1);

  // Checkpoint quiz state per session
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});

  // Inline AI Mentor question state
  const [mentorQuestion, setMentorQuestion] = useState('');
  const [mentorReply, setMentorReply] = useState<string | null>(null);
  const [mentorLoading, setMentorLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoTriggeredRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const speechStartedRef = useRef(false);

  useEffect(() => {
    if (initialSessionKey) {
      setActiveKey(initialSessionKey);
    }
  }, [initialSessionKey]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const idxA = SESSION_ORDER.indexOf(a.sessionKey);
      const idxB = SESSION_ORDER.indexOf(b.sessionKey);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
  }, [sessions]);

  const activeSession =
    sortedSessions.find((s) => s.sessionKey === activeKey) || sortedSessions[0] || null;

  const activeMedia = activeSession?.video || null;
  const activeSceneScript = useMemo(() => resolveSceneScript(activeMedia), [activeMedia]);
  const isLegacyMp4 = Boolean(
    activeMedia?.videoDataBase64 && activeMedia.mimeType && activeMedia.mimeType.startsWith('video/')
  );

  const stopNarration = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    speechStartedRef.current = false;
  };

  useEffect(() => {
    stopNarration();
    setVideoTimeSec(0);
    setIsPlaying(false);
    setMentorReply(null);
  }, [activeKey, career.id]);

  const triggerSessionGeneration = async (
    target: CareerVideoSessionPlan,
    forceRegenerate = false
  ) => {
    setGeneratingKey(target.sessionKey);
    setVideoErrors((prev) => {
      const next = { ...prev };
      delete next[target.sessionKey];
      return next;
    });

    try {
      const res = await generateCareerJourneyVideoSession({
        careerId: career.id,
        sessionKey: target.sessionKey,
        levelNumber: target.levelNumber,
        sessionTitle: target.title,
        animationPrompt: target.animationPrompt,
        narrationScript: target.narrationScript,
        subtitles: target.subtitles,
        checkpoint: target.checkpoint,
        forceRegenerate,
      });

      setSessions((prev) =>
        prev.map((item) =>
          item.sessionKey === target.sessionKey ? { ...item, video: res.video } : item
        )
      );
      setVideoTimeSec(0);
    } catch (err) {
      const apiErr = err as ApiError;
      const msg =
        apiErr instanceof Error
          ? apiErr.message
          : 'Unable to generate animated scene script for this session.';
      setVideoErrors((prev) => ({
        ...prev,
        [target.sessionKey]: { message: msg, retryAfterSec: apiErr?.retryAfterSeconds },
      }));
    } finally {
      setGeneratingKey((curr) => (curr === target.sessionKey ? null : curr));
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoadingPlan(true);
    setPlanError(null);
    setVideoErrors({});

    fetchCareerJourneyPlan(career.id, profile)
      .then((res) => {
        if (!mounted) return;
        const nextSessions = res.sessions || [];
        setSessions(nextSessions);

        const defaultKey = initialSessionKey || 'after-12th';
        const target =
          nextSessions.find((s) => s.sessionKey === defaultKey) || nextSessions[0];
        if (target) {
          setActiveKey(target.sessionKey);
          const triggerId = `${career.id}:${target.sessionKey}`;
          if (
            autoGenerateFirstSession &&
            !target.video &&
            !autoTriggeredRef.current.has(triggerId)
          ) {
            autoTriggeredRef.current.add(triggerId);
            void triggerSessionGeneration(target, false);
          }
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setPlanError(
          err instanceof Error ? err.message : 'Unable to load career video journey.'
        );
      })
      .finally(() => {
        if (mounted) setLoadingPlan(false);
      });

    return () => {
      mounted = false;
      stopNarration();
    };
  }, [career.id]);

  const activeWatchId = activeSession ? `${career.id}:${activeSession.sessionKey}` : '';
  const isSessionWatched = activeWatchId
    ? watchedVideoSessionIds.includes(activeWatchId)
    : false;

  const watchedInCareerCount = useMemo(() => {
    return sortedSessions.filter((s) =>
      watchedVideoSessionIds.includes(`${career.id}:${s.sessionKey}`)
    ).length;
  }, [sortedSessions, watchedVideoSessionIds, career.id]);

  // HTML/CSS/JS Animated Scene Timeline Runner
  const totalDurationSec = activeSceneScript?.totalDurationSec || 20;

  useEffect(() => {
    if (!activeSceneScript || !isPlaying || isLegacyMp4) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }
      const deltaSec = ((now - lastFrameRef.current) / 1000) * playbackRate;
      lastFrameRef.current = now;

      setVideoTimeSec((prev) => {
        const next = prev + deltaSec;
        if (next >= totalDurationSec) {
          setIsPlaying(false);
          if (activeWatchId) {
            onMarkSessionWatched(activeWatchId);
          }
          return totalDurationSec;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = null;
    };
  }, [activeSceneScript, isPlaying, isLegacyMp4, playbackRate, totalDurationSec, activeWatchId, onMarkSessionWatched]);

  const currentSceneMeta = useMemo(() => {
    if (!activeSceneScript) return null;
    let elapsed = 0;
    for (let i = 0; i < activeSceneScript.scenes.length; i++) {
      const sc = activeSceneScript.scenes[i];
      const end = elapsed + sc.durationSec;
      if (videoTimeSec <= end || i === activeSceneScript.scenes.length - 1) {
        const localProgress = Math.max(0, Math.min(1, (videoTimeSec - elapsed) / Math.max(1, sc.durationSec)));
        return { scene: sc, index: i, startSec: elapsed, endSec: end, localProgress };
      }
      elapsed = end;
    }
    return {
      scene: activeSceneScript.scenes[0],
      index: 0,
      startSec: 0,
      endSec: activeSceneScript.scenes[0].durationSec,
      localProgress: 0,
    };
  }, [activeSceneScript, videoTimeSec]);

  const activeSubtitleText = useMemo(() => {
    if (!activeSession || !subtitlesEnabled) return '';
    const cues = activeSession.video?.subtitles?.length
      ? activeSession.video.subtitles
      : activeSession.subtitles;
    if (!cues?.length) return '';
    const match = cues.find(
      (c) => videoTimeSec >= c.startSec && videoTimeSec <= c.endSec + 0.4
    );
    return match ? match.text : cues[0].text;
  }, [activeSession, subtitlesEnabled, videoTimeSec]);

  const startNarrationPlayback = () => {
    if (!narrationEnabled) return;
    if (activeMedia?.audioBase64 && audioRef.current) {
      audioRef.current.currentTime = Math.min(videoTimeSec, audioRef.current.duration || videoTimeSec);
      audioRef.current.play().catch(() => {});
      return;
    }
    const narrationText = activeMedia?.narrationScript || activeSession?.narrationScript;
    if (
      narrationText &&
      !speechStartedRef.current &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(narrationText);
      utter.rate = playbackRate;
      speechStartedRef.current = true;
      window.speechSynthesis.speak(utter);
    }
  };

  const pauseNarrationPlayback = () => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      speechStartedRef.current = false;
    }
  };

  const handleToggleScenePlay = () => {
    if (isLegacyMp4 && videoRef.current) {
      if (videoRef.current.paused) {
        void videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
      return;
    }

    if (isPlaying) {
      setIsPlaying(false);
      pauseNarrationPlayback();
    } else {
      if (videoTimeSec >= totalDurationSec - 0.1) {
        setVideoTimeSec(0);
        speechStartedRef.current = false;
      }
      setIsPlaying(true);
      startNarrationPlayback();
    }
  };

  const handleRestartAnimation = () => {
    stopNarration();
    setVideoTimeSec(0);
    if (isLegacyMp4 && videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play().catch(() => {});
    } else if (activeSceneScript) {
      setIsPlaying(true);
      startNarrationPlayback();
    }
  };

  const handleSeek = (nextSec: number) => {
    const clamped = Math.max(0, Math.min(totalDurationSec, nextSec));
    setVideoTimeSec(clamped);
    if (audioRef.current && activeMedia?.audioBase64) {
      audioRef.current.currentTime = clamped;
    }
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
    if (narrationEnabled && activeMedia?.audioBase64 && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    pauseNarrationPlayback();
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (activeWatchId) {
      onMarkSessionWatched(activeWatchId);
    }
  };

  const handleToggleNarration = () => {
    const next = !narrationEnabled;
    setNarrationEnabled(next);
    if (!next) {
      pauseNarrationPlayback();
    } else if (isPlaying) {
      startNarrationPlayback();
    }
  };

  const handleCheckCheckpoint = () => {
    if (!activeSession) return;
    setCheckedAnswers((prev) => ({ ...prev, [activeSession.sessionKey]: true }));
    if (activeWatchId) {
      onMarkSessionWatched(activeWatchId);
    }
  };

  const handleAskStageMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = mentorQuestion.trim();
    if (!q || !activeSession || mentorLoading) return;
    setMentorLoading(true);
    try {
      const res = await askExploreMentor({
        question: `[Career Video Session: ${activeSession.title}] ${q}`,
        profile,
        focusedCareerId: career.id,
      });
      setMentorReply(res.reply);
      setMentorQuestion('');
    } catch (err) {
      setMentorReply(
        err instanceof Error ? err.message : 'Unable to reach AI Career Mentor right now.'
      );
    } finally {
      setMentorLoading(false);
    }
  };

  if (loadingPlan) {
    return (
      <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-8 flex items-center justify-center gap-3 text-xs text-[#D6C7DF]">
        <Loader2 className="w-5 h-5 animate-spin text-[#F4A62A]" />
        <span>
          Preparing 7 animated career journey sessions (12th pass to {career.title} job)...
        </span>
      </div>
    );
  }

  if (planError || !activeSession) {
    return (
      <div className="bg-[#2D2B55] border border-red-500/40 rounded-2xl p-6 text-xs text-red-200 flex items-center gap-3">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{planError || 'No animated journey sessions available for this career.'}</span>
      </div>
    );
  }

  const isGeneratingActive = generatingKey === activeSession.sessionKey;
  const activeError = videoErrors[activeSession.sessionKey];
  const selectedOpt = selectedAnswers[activeSession.sessionKey];
  const isChecked = Boolean(checkedAnswers[activeSession.sessionKey]);
  const isCheckpointCorrect =
    isChecked && selectedOpt === activeSession.checkpoint.correctIndex;
  const progressPct = totalDurationSec > 0 ? Math.min(100, (videoTimeSec / totalDurationSec) * 100) : 0;

  return (
    <section className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl overflow-hidden shadow-[0_24px_48px_rgba(12,11,22,0.5)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#6A5ACD]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#222042]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F4A62A]/15 border border-[#F4A62A]/45 text-[#F4A62A] flex items-center justify-center shrink-0">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-mono font-medium text-[#F4A62A]">
              Animated Career Journey · HTML/CSS/JS Motion + Gemini Scene Scripts
            </div>
            <h2 className="text-base sm:text-lg font-display font-bold text-[#F0D9B5]">
              {career.title}: Step-by-Step Animated Sessions
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          {activeSceneScript?.modelUsed && (
            <span className="hidden md:inline-flex rounded-lg border border-[#A678B9]/45 bg-[#1A1A1F] px-2.5 py-1.5 text-[11px] text-[#D6C7DF]">
              {activeSceneScript.modelUsed}
            </span>
          )}
          <span className="rounded-lg border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-1.5 text-[#F0D9B5]">
            <strong className="text-[#F4A62A]">{watchedInCareerCount}</strong> /{' '}
            {sortedSessions.length} Watched
          </span>
        </div>
      </div>

      {/* 7-Session Timeline Selector */}
      <div className="px-5 py-3 border-b border-[#6A5ACD]/35 bg-[#1A1A1F]/70 flex items-center gap-2 overflow-x-auto">
        {sortedSessions.map((sess) => {
          const isCurrent = sess.sessionKey === activeSession.sessionKey;
          const watched = watchedVideoSessionIds.includes(`${career.id}:${sess.sessionKey}`);
          const hasScene = Boolean(resolveSceneScript(sess.video) || sess.video?.videoDataBase64);
          const isBusy = generatingKey === sess.sessionKey;
          return (
            <button
              key={sess.sessionKey}
              type="button"
              onClick={() => setActiveKey(sess.sessionKey)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                isCurrent
                  ? 'bg-[#F4A62A] text-[#1A1A1F] border-[#F4A62A] font-semibold'
                  : watched
                    ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40 hover:border-emerald-400'
                    : hasScene
                      ? 'bg-[#2D2B55] text-[#F0D9B5] border-[#6A5ACD]/55 hover:border-[#F4A62A]'
                      : 'bg-[#1A1A1F] text-[#D6C7DF] border-[#6A5ACD]/35 hover:text-[#F0D9B5]'
              }`}
            >
              {isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : watched ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              <span>
                {sess.levelNumber === 0 ? 'Overview' : `S0${sess.levelNumber}`} ·{' '}
                {sess.stageLabel.split('·')[1]?.trim() || sess.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Session Body */}
      <div className={`p-5 ${compact ? 'space-y-5' : 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'}`}>
        {/* Left: HTML/CSS/JS Animated Player + Controls + Subtitles */}
        <div className={`${compact ? 'space-y-4' : 'lg:col-span-7 space-y-4'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-mono text-[#F4A62A]">{activeSession.stageLabel}</div>
              <h3 className="mt-0.5 text-lg font-display font-bold text-[#F0D9B5]">
                {activeSession.title}
              </h3>
              <p className="text-xs text-[#D6C7DF] mt-0.5">{activeSession.subtitle}</p>
            </div>
            {isSessionWatched && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Watched</span>
              </span>
            )}
          </div>

          {/* Animated Stage Canvas */}
          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#6A5ACD]/50 bg-[#1A1A1F] flex items-center justify-center">
            {isLegacyMp4 && activeMedia ? (
              <>
                <video
                  ref={videoRef}
                  key={`${activeMedia.id}-${activeSession.sessionKey}`}
                  controls
                  playsInline
                  onTimeUpdate={(e) => setVideoTimeSec(e.currentTarget.currentTime)}
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                  onEnded={handleVideoEnded}
                  className="w-full h-full object-contain bg-black"
                  src={`data:${activeMedia.mimeType};base64,${activeMedia.videoDataBase64}`}
                />
                {subtitlesEnabled && activeSubtitleText && (
                  <div className="pointer-events-none absolute bottom-12 inset-x-4 flex justify-center">
                    <div className="rounded-lg bg-[#1A1A1F]/90 border border-[#F4A62A]/45 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#F0D9B5] text-center shadow-lg max-w-xl">
                      {activeSubtitleText}
                    </div>
                  </div>
                )}
              </>
            ) : activeSceneScript && currentSceneMeta ? (
              <div
                className="vectra-stage relative w-full h-full flex flex-col justify-between p-4 sm:p-6 overflow-hidden select-none"
                data-paused={!isPlaying ? 'true' : 'false'}
                style={{
                  background:
                    'radial-gradient(circle at 18% 20%, rgba(244,166,42,0.16), transparent 45%), radial-gradient(circle at 82% 80%, rgba(106,90,205,0.28), transparent 50%), linear-gradient(145deg, #16161c 0%, #242246 55%, #1a1a1f 100%)',
                }}
              >
                {/* Sweeping CSS light beam */}
                <div
                  aria-hidden="true"
                  className="vectra-beam-sweep pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#F4A62A]/12 to-transparent skew-x-[-18deg]"
                />

                {/* Top Scene HUD */}
                <div className="relative z-10 flex items-center justify-between gap-2 text-[11px] font-mono">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-[#F4A62A]/45 bg-[#1A1A1F]/80 px-2.5 py-1 text-[#F4A62A]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F4A62A]" />
                    <span>
                      Scene {currentSceneMeta.index + 1}/{activeSceneScript.scenes.length} ·{' '}
                      {currentSceneMeta.scene.badge}
                    </span>
                  </div>
                  <div className="rounded-lg border border-[#6A5ACD]/45 bg-[#1A1A1F]/80 px-2.5 py-1 text-[#D6C7DF]">
                    {currentSceneMeta.scene.statLabel}:{' '}
                    <strong className="text-[#F0D9B5]">{currentSceneMeta.scene.statValue}</strong>
                  </div>
                </div>

                {/* Animated Scene Keyframe Card */}
                <div
                  key={`${activeSession.sessionKey}-${currentSceneMeta.scene.id}`}
                  className="vectra-scene-in relative z-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 my-auto py-2"
                >
                  <SceneMetaphorArtwork
                    metaphor={currentSceneMeta.scene.visualMetaphor}
                    progressRatio={currentSceneMeta.localProgress}
                  />

                  <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
                    <div className="text-[11px] font-mono text-[#A678B9]">
                      {currentSceneMeta.scene.title}
                    </div>
                    <h4 className="text-base sm:text-xl font-display font-bold text-[#F0D9B5] leading-snug">
                      {currentSceneMeta.scene.headline}
                    </h4>
                    <ul className="space-y-1 text-xs text-[#D6C7DF]">
                      {currentSceneMeta.scene.keyPoints.map((pt) => (
                        <li
                          key={pt}
                          className="flex items-center justify-center sm:justify-start gap-2"
                        >
                          <Award className="w-3.5 h-3.5 text-[#F4A62A] shrink-0" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Timed Subtitles Overlay */}
                {subtitlesEnabled && activeSubtitleText && (
                  <div className="relative z-10 flex justify-center mb-2">
                    <div className="rounded-lg bg-[#1A1A1F]/92 border border-[#F4A62A]/45 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#F0D9B5] text-center shadow-lg max-w-xl">
                      {activeSubtitleText}
                    </div>
                  </div>
                )}

                {/* Bottom Timeline Scrubber */}
                <div className="relative z-10 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleScenePlay}
                      className="w-7 h-7 rounded-lg bg-[#F4A62A] text-[#1A1A1F] flex items-center justify-center hover:bg-[#F7B64C] shrink-0"
                      aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={totalDurationSec}
                      step={0.1}
                      value={videoTimeSec}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      aria-label="Seek animation timeline"
                      className="flex-1 accent-[#F4A62A] cursor-pointer h-1.5"
                    />
                    <span className="text-[11px] font-mono tabular-nums text-[#F0D9B5] shrink-0">
                      {formatClock(videoTimeSec)} / {formatClock(totalDurationSec)}
                    </span>
                  </div>

                  {/* Scene Segment Markers */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {activeSceneScript.scenes.map((sc, idx) => {
                      const isActiveScene = idx === currentSceneMeta.index;
                      const sceneStart = activeSceneScript.scenes
                        .slice(0, idx)
                        .reduce((sum, item) => sum + item.durationSec, 0);
                      return (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => handleSeek(sceneStart + 0.05)}
                          className={`rounded px-2 py-1 text-[10px] font-mono truncate border transition-colors ${
                            isActiveScene
                              ? 'border-[#F4A62A] bg-[#F4A62A]/20 text-[#F4A62A]'
                              : 'border-[#6A5ACD]/35 bg-[#1A1A1F]/70 text-[#D6C7DF] hover:text-[#F0D9B5]'
                          }`}
                        >
                          {idx + 1}. {sc.badge}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Progress bar hairline */}
                <div
                  className="absolute bottom-0 left-0 h-0.5 bg-[#F4A62A] transition-all duration-100"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            ) : isGeneratingActive ? (
              <div className="p-6 text-center space-y-3 max-w-md">
                <Loader2 className="w-8 h-8 animate-spin text-[#F4A62A] mx-auto" />
                <div className="text-sm font-display font-bold text-[#F0D9B5]">
                  Composing Gemini Animated Scene Script...
                </div>
                <p className="text-xs text-[#D6C7DF] leading-relaxed">
                  Building your custom 4-scene animated storyboard and captions for "{activeSession.title}". Cached automatically for instant replay.
                </p>
              </div>
            ) : (
              <div className="p-6 text-center space-y-3 max-w-md">
                <div className="mx-auto w-11 h-11 rounded-full bg-[#2D2B55] border border-[#6A5ACD]/50 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#F4A62A]" />
                </div>
                <div className="text-sm font-display font-bold text-[#F0D9B5]">
                  Ready to Animate "{activeSession.title}"
                </div>
                <p className="text-xs text-[#D6C7DF] leading-relaxed">
                  Generate this 4-scene HTML/CSS/JS animated career session with Gemini scene scripting, voiceover, and timed captions.
                </p>
                <button
                  type="button"
                  onClick={() => triggerSessionGeneration(activeSession, false)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Generate Animated Session</span>
                </button>
              </div>
            )}
          </div>

          {/* Hidden Gemini TTS Narration Audio Element */}
          {activeMedia?.audioBase64 && (
            <audio
              ref={audioRef}
              key={`audio-${activeMedia.id}-${activeSession.sessionKey}`}
              src={`data:audio/wav;base64,${activeMedia.audioBase64}`}
            />
          )}

          {/* Real Error Display (Never faked/mocked) */}
          {activeError && (
            <div className="rounded-xl border border-red-500/45 bg-red-950/60 px-4 py-3 text-xs text-red-200 space-y-2">
              <div className="font-semibold flex items-center justify-between gap-2 text-red-100">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Animated Scene Generation Paused</span>
                </span>
                <button
                  type="button"
                  disabled={isGeneratingActive}
                  onClick={() => triggerSessionGeneration(activeSession, false)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F4A62A] px-2.5 py-1 text-[11px] font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
              <p className="leading-relaxed">{activeError.message}</p>
              <p className="text-[11px] text-red-200/80">
                {activeError.retryAfterSec
                  ? `Suggested cooldown: ~${activeError.retryAfterSec}s. Meanwhile you can review the full stage script, key takeaways, interactive checkpoint, and AI Mentor below.`
                  : 'You can still review the full stage script, key takeaways, interactive checkpoint, and AI Mentor below.'}
              </p>
            </div>
          )}

          {/* Playback & Accessibility Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {(activeSceneScript || isLegacyMp4) && (
                <>
                  <button
                    type="button"
                    onClick={handleToggleScenePlay}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#F4A62A] px-3 py-1.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? 'Pause' : 'Play Animation'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRestartAnimation}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#6A5ACD]/45 bg-[#2D2B55] px-2.5 py-1.5 text-xs font-medium text-[#F0D9B5] hover:border-[#F4A62A]"
                    title="Restart session animation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  {!isLegacyMp4 && (
                    <button
                      type="button"
                      onClick={() => setPlaybackRate((r) => (r === 1 ? 1.25 : 1))}
                      className="rounded-lg border border-[#6A5ACD]/45 bg-[#2D2B55] px-2.5 py-1.5 text-xs font-mono text-[#F0D9B5] hover:border-[#F4A62A]"
                    >
                      {playbackRate}x
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={handleToggleNarration}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  narrationEnabled
                    ? 'border-[#A678B9]/60 bg-[#2D2B55] text-[#F0D9B5]'
                    : 'border-[#6A5ACD]/40 bg-[#1A1A1F] text-[#D6C7DF]'
                }`}
              >
                {narrationEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-[#F4A62A]" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <span>{narrationEnabled ? 'Voiceover On' : 'Voiceover Muted'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSubtitlesEnabled((s) => !s)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  subtitlesEnabled
                    ? 'border-[#A678B9]/60 bg-[#2D2B55] text-[#F0D9B5]'
                    : 'border-[#6A5ACD]/40 bg-[#1A1A1F] text-[#D6C7DF]'
                }`}
              >
                <Captions className="w-3.5 h-3.5 text-[#F4A62A]" />
                <span>{subtitlesEnabled ? 'CC On' : 'CC Off'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!isSessionWatched && (
                <button
                  type="button"
                  onClick={() => activeWatchId && onMarkSessionWatched(activeWatchId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Watched</span>
                </button>
              )}
              <button
                type="button"
                disabled={isGeneratingActive}
                onClick={() => triggerSessionGeneration(activeSession, Boolean(activeMedia))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#6A5ACD]/50 bg-[#2D2B55] px-3 py-1.5 text-xs font-medium text-[#F0D9B5] hover:border-[#F4A62A] disabled:opacity-50 transition-colors"
              >
                {isGeneratingActive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F4A62A]" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-[#F4A62A]" />
                )}
                <span>{activeMedia ? 'Regenerate Script' : 'Generate Animation'}</span>
              </button>
            </div>
          </div>

          {/* Narration Script Card */}
          <div className="rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-4 space-y-2">
            <div className="text-[11px] font-mono font-semibold text-[#A678B9]">
              Session Narration &amp; Key Takeaways
            </div>
            <p className="text-xs sm:text-sm text-[#F0D9B5] leading-relaxed">
              {activeMedia?.narrationScript || activeSession.narrationScript}
            </p>
            <ul className="pt-2 border-t border-[#6A5ACD]/30 space-y-1.5">
              {activeSession.keyTakeaways.map((item) => (
                <li key={item} className="text-xs text-[#D6C7DF] flex items-start gap-2">
                  <span className="text-[#F4A62A] font-bold">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Interactive Checkpoint + Ask AI Mentor */}
        <div className={`${compact ? 'space-y-4' : 'lg:col-span-5 space-y-4'}`}>
          {/* Interactive Checkpoint */}
          <div className="rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F4A62A]">
              <HelpCircle className="w-4 h-4" />
              <span>Session Understanding Check</span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-[#F0D9B5] leading-relaxed">
              {activeSession.checkpoint.question}
            </p>
            <div className="space-y-2">
              {activeSession.checkpoint.options.map((opt, idx) => {
                const chosen = selectedOpt === idx;
                const isRightOption = idx === activeSession.checkpoint.correctIndex;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSelectedAnswers((prev) => ({ ...prev, [activeSession.sessionKey]: idx }));
                      setCheckedAnswers((prev) => ({ ...prev, [activeSession.sessionKey]: false }));
                    }}
                    className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed transition-colors ${
                      isChecked && isRightOption
                        ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                        : isChecked && chosen && !isRightOption
                          ? 'border-red-400 bg-red-500/15 text-red-100'
                          : chosen
                            ? 'border-[#F4A62A] bg-[#F4A62A]/15 text-[#F0D9B5]'
                            : 'border-[#6A5ACD]/40 bg-[#2D2B55]/50 text-[#D6C7DF] hover:text-[#F0D9B5]'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={typeof selectedOpt !== 'number'}
              onClick={handleCheckCheckpoint}
              className="w-full rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-50 transition-colors"
            >
              Verify Understanding &amp; Complete Session
            </button>

            {isChecked && (
              <div
                className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                  isCheckpointCorrect
                    ? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-200'
                    : 'border-[#F4A62A]/45 bg-[#F4A62A]/10 text-[#F0D9B5]'
                }`}
              >
                <span className="font-semibold">
                  {isCheckpointCorrect ? 'Great job! ' : 'Good try — '}
                </span>
                {activeSession.checkpoint.explanation}
              </div>
            )}
          </div>

          {/* Ask AI Mentor About This Stage */}
          <div className="rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F0D9B5]">
              <MessageSquare className="w-4 h-4 text-[#A678B9]" />
              <span>Ask AI Mentor About This Stage</span>
            </div>
            <p className="text-[11px] text-[#D6C7DF] leading-relaxed">
              Have a question about {activeSession.stageLabel.split('·')[1]?.trim() || 'this step'} for {career.title}? Ask VECTORA AI right here.
            </p>

            {mentorReply && (
              <div className="rounded-xl border border-[#A678B9]/45 bg-[#2D2B55] p-3 text-xs text-[#F0D9B5] leading-relaxed">
                {mentorReply}
              </div>
            )}

            <form onSubmit={handleAskStageMentor} className="flex gap-2">
              <input
                type="text"
                value={mentorQuestion}
                onChange={(e) => setMentorQuestion(e.target.value)}
                placeholder="e.g. Which exam should I take first?"
                className="flex-1 rounded-xl border border-[#6A5ACD]/50 bg-[#2D2B55]/60 px-3 py-2 text-xs text-[#F0D9B5] placeholder:text-[#A678B9]/70 focus:outline-none focus:ring-1 focus:ring-[#F4A62A]"
              />
              <button
                type="submit"
                disabled={mentorLoading || !mentorQuestion.trim()}
                className="inline-flex items-center gap-1 rounded-xl bg-[#F4A62A] px-3.5 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-50 transition-colors"
              >
                {mentorLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
