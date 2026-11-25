import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  Camera,
  CameraOff,
  CheckCircle2,
  Eye,
  HelpCircle,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Send,
  ShieldCheck,
  SkipForward,
  Sparkles,
  UserCheck,
  Video,
  Volume2,
} from 'lucide-react';
import { evaluateVideoInterview, getActiveIdToken } from '../api/client';
import type {
  InterviewMessage,
  StudentProfile,
  VideoInterviewReport,
} from '../types';

interface VideoCallInterviewerProps {
  profile: StudentProfile;
  existingReport?: VideoInterviewReport | null;
  onReportComplete: (report: VideoInterviewReport, transcriptMessages: InterviewMessage[]) => void;
  onGenerateRecommendations: () => Promise<void>;
  generatingRecs: boolean;
}

interface LiveTranscriptTurn {
  id: string;
  speaker: 'You' | 'AI Interviewer';
  text: string;
}

function pcmFloat32ToBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64PcmToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const VideoCallInterviewer: React.FC<VideoCallInterviewerProps> = ({
  profile,
  existingReport,
  onReportComplete,
  onGenerateRecommendations,
  generatingRecs,
}) => {
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'live' | 'evaluating' | 'report'>(
    existingReport ? 'report' : 'idle'
  );
  const [report, setReport] = useState<VideoInterviewReport | null>(existingReport || null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [turns, setTurns] = useState<LiveTranscriptTurn[]>([]);
  const [optionalText, setOptionalText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef(0);

  const mutedRef = useRef(false);
  const cameraOnRef = useRef(true);
  const turnsRef = useRef<LiveTranscriptTurn[]>([]);
  const sampledFramesRef = useRef<string[]>([]);
  const frameTickCountRef = useRef(0);
  const elapsedRef = useRef(0);

  mutedRef.current = muted;
  cameraOnRef.current = cameraOn;
  turnsRef.current = turns;
  elapsedRef.current = elapsedSeconds;

  useEffect(() => {
    if (existingReport && callState === 'idle') {
      setReport(existingReport);
      setCallState('report');
    }
  }, [existingReport, callState]);

  useEffect(() => {
    if (videoElRef.current && streamRef.current && callState === 'live') {
      videoElRef.current.srcObject = streamRef.current;
    }
  }, [callState, cameraOn]);

  const stopPlaybackQueue = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    });
    activeSourcesRef.current = [];
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setAiSpeaking(false);
  };

  const cleanupMediaAndSocket = () => {
    stopPlaybackQueue();

    if (frameIntervalRef.current !== null) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    try {
      processorRef.current?.disconnect();
    } catch {
      // ignore
    }
    processorRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setMicLevel(0);
    setAiSpeaking(false);
  };

  useEffect(() => {
    return () => {
      cleanupMediaAndSocket();
    };
  }, []);

  const playPcmChunk = (base64Audio: string) => {
    const outCtx = outputCtxRef.current;
    if (!outCtx) return;
    const samples = base64PcmToFloat32(base64Audio);
    const buffer = outCtx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = outCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;
    setAiSpeaking(true);

    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      if (activeSourcesRef.current.length === 0) {
        setAiSpeaking(false);
      }
    };
  };

  const appendTurn = (speaker: 'You' | 'AI Interviewer', text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker) {
        const next = [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text} ${cleaned}`.replace(/\s+/g, ' ').trim() },
        ];
        turnsRef.current = next;
        return next;
      }
      const next = [
        ...prev,
        { id: `turn_${Date.now()}_${Math.random()}`, speaker, text: cleaned },
      ];
      turnsRef.current = next;
      return next;
    });
  };

  const captureAndStreamVideoFrame = () => {
    const videoEl = videoElRef.current;
    const ws = wsRef.current;
    if (!videoEl || !ws || ws.readyState !== WebSocket.OPEN || !cameraOnRef.current) return;
    if (videoEl.readyState < 2 || videoEl.videoWidth === 0) return;

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas');
    }
    const canvas = captureCanvasRef.current;
    const targetW = 480;
    const targetH = Math.round((videoEl.videoHeight / videoEl.videoWidth) * targetW) || 360;
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, targetW, targetH);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    const base64Jpeg = dataUrl.split(',')[1];
    if (!base64Jpeg) return;

    ws.send(JSON.stringify({ video: base64Jpeg }));

    frameTickCountRef.current += 1;
    const currentFrames = sampledFramesRef.current;
    if (currentFrames.length < 6) {
      currentFrames.push(base64Jpeg);
    } else if (frameTickCountRef.current % 5 === 0) {
      currentFrames.shift();
      currentFrames.push(base64Jpeg);
    }
  };

  const startVideoInterview = async (voiceOnly = false) => {
    setErrorMsg(null);
    setTurns([]);
    turnsRef.current = [];
    sampledFramesRef.current = [];
    frameTickCountRef.current = 0;
    setElapsedSeconds(0);
    elapsedRef.current = 0;
    setMuted(false);
    mutedRef.current = false;
    setCallState('connecting');

    try {
      const token = await getActiveIdToken();
      if (!token) {
        throw new Error('Please sign in before starting the live video interview.');
      }

      let stream: MediaStream;
      let hasVideo = !voiceOnly;
      if (voiceOnly) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user',
            },
          });
        } catch {
          hasVideo = false;
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        }
      }

      streamRef.current = stream;
      setCameraAvailable(hasVideo);
      setCameraOn(hasVideo);
      cameraOnRef.current = hasVideo;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const qs = new URLSearchParams({
        token,
        mode: 'video_interview',
        context: 'Video Call Interviewer',
        career: profile.academicStream,
        studentName: profile.fullName,
        stage: profile.educationStage,
        stream: profile.academicStream,
        subjects: (profile.topSubjects || []).join(', '),
        curiosities: profile.curiosities || '',
      });
      const ws = new WebSocket(`${protocol}//${window.location.host}/live?${qs.toString()}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const audioSource = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        audioSource.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (ev) => {
          const channelData = ev.inputBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 0; i < channelData.length; i++) {
            sum += channelData[i] * channelData[i];
          }
          const rms = Math.sqrt(sum / channelData.length);
          setMicLevel(mutedRef.current ? 0 : Math.min(100, Math.round(rms * 420)));

          if (mutedRef.current || ws.readyState !== WebSocket.OPEN) return;
          const base64 = pcmFloat32ToBase64(channelData);
          ws.send(JSON.stringify({ audio: base64 }));
        };
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.ready) {
          setCallState('live');
          if (videoElRef.current && streamRef.current) {
            videoElRef.current.srcObject = streamRef.current;
          }
          frameIntervalRef.current = window.setInterval(captureAndStreamVideoFrame, 1500);
          timerIntervalRef.current = window.setInterval(() => {
            setElapsedSeconds((s) => s + 1);
          }, 1000);

          ws.send(
            JSON.stringify({
              text: `Hello, I am ${profile.fullName} and I have joined the video call interview. Please greet me warmly and ask your first opening question via voice.`,
            })
          );
        }
        if (msg.error) {
          setErrorMsg(msg.error);
          cleanupMediaAndSocket();
          setCallState('idle');
          return;
        }
        if (msg.audio) {
          playPcmChunk(msg.audio);
        }
        if (msg.interrupted) {
          stopPlaybackQueue();
        }
        if (msg.inputTranscript) {
          appendTurn('You', msg.inputTranscript);
        }
        if (msg.outputTranscript) {
          appendTurn('AI Interviewer', msg.outputTranscript);
        }
      };

      ws.onerror = () => {
        setErrorMsg('Live video call connection encountered a network error.');
        cleanupMediaAndSocket();
        setCallState((prev) => (prev === 'live' ? 'idle' : prev));
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          cleanupMediaAndSocket();
        }
      };
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not access microphone/camera. Please allow browser permissions and try again.'
      );
      cleanupMediaAndSocket();
      setCallState('idle');
    }
  };

  const toggleCamera = () => {
    if (!streamRef.current) return;
    const videoTracks = streamRef.current.getVideoTracks();
    if (videoTracks.length === 0) return;
    const next = !cameraOn;
    videoTracks.forEach((t) => {
      t.enabled = next;
    });
    setCameraOn(next);
    cameraOnRef.current = next;
  };

  const sendQuickInterviewSignal = (text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    appendTurn('You', text);
    wsRef.current.send(JSON.stringify({ text }));
  };

  const handleSendOptionalText = (e: React.FormEvent) => {
    e.preventDefault();
    const text = optionalText.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setOptionalText('');
    appendTurn('You', text);
    wsRef.current.send(JSON.stringify({ text }));
  };

  const handleEndAndGenerateReport = async () => {
    const capturedTurns = [...turnsRef.current];
    const capturedFrames = [...sampledFramesRef.current];
    const duration = elapsedRef.current;
    const wasCamOn = cameraAvailable && cameraOnRef.current;

    cleanupMediaAndSocket();

    const studentReplies = capturedTurns.filter((t) => t.speaker === 'You');
    if (capturedTurns.length === 0 || studentReplies.length === 0) {
      setErrorMsg(
        'Speak or share at least one response during the call so the AI can evaluate your knowledge, communication, and confidence.'
      );
      setCallState('idle');
      return;
    }

    setErrorMsg(null);
    setCallState('evaluating');

    try {
      const res = await evaluateVideoInterview({
        profile,
        transcript: capturedTurns.map((t) => ({
          speaker: t.speaker === 'AI Interviewer' ? 'AI' : 'Student',
          text: t.text,
        })),
        videoFrames: capturedFrames,
        durationSeconds: duration,
        cameraEnabled: wasCamOn,
      });

      const convertedMessages: InterviewMessage[] = capturedTurns.map((t, idx) => ({
        id: `vid_msg_${Date.now()}_${idx}`,
        role: t.speaker === 'AI Interviewer' ? 'ai' : 'student',
        content: t.text,
        phase: 5,
        phaseLabel: 'Live Video Call Interview',
        timestamp: new Date().toISOString(),
      }));

      setReport(res.report);
      setCallState('report');
      onReportComplete(res.report, convertedMessages);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to generate interview performance report.');
      setCallState('idle');
    }
  };

  const latestAiCaption = [...turns]
    .reverse()
    .find((t) => t.speaker === 'AI Interviewer')?.text;

  if (callState === 'evaluating') {
    return (
      <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-12 text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#F4A62A] mx-auto" />
        <h2 className="text-lg font-display font-bold text-[#F0D9B5]">
          Analyzing Your Video Interview Performance
        </h2>
        <p className="text-sm text-[#D6C7DF] max-w-lg mx-auto leading-relaxed">
          Evaluating communication skills, subject knowledge, response quality, speaking confidence, body language, eye contact, and facial expressions across your call...
        </p>
      </div>
    );
  }

  if (callState === 'report' && report) {
    const coreDimensions = [
      { key: 'communication', label: 'Communication Skills', data: report.communicationSkills },
      { key: 'knowledge', label: 'Subject Knowledge', data: report.subjectKnowledge },
      { key: 'confidence', label: 'Confidence', data: report.confidence },
      { key: 'quality', label: 'Response Quality', data: report.responseQuality },
    ];

    const nonVerbalCards = [
      { label: 'Body Language & Posture', icon: UserCheck, data: report.nonVerbalAnalysis.bodyLanguage },
      { label: 'Eye Contact', icon: Eye, data: report.nonVerbalAnalysis.eyeContact },
      { label: 'Facial Expressions', icon: Sparkles, data: report.nonVerbalAnalysis.facialExpressions },
      { label: 'Speaking Confidence', icon: Volume2, data: report.nonVerbalAnalysis.speakingConfidence },
    ];

    return (
      <div className="space-y-6">
        {/* Overall Performance Header */}
        <section className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 sm:p-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#6A5ACD]/35 pb-6">
            <div>
              <div className="text-xs font-mono font-medium text-[#F4A62A]">
                Performance Report · {formatDuration(report.durationSeconds)} Call
                {report.cameraAnalyzed ? ' · Audio + Video Analyzed' : ' · Audio Transcript Analyzed'}
              </div>
              <h2 className="mt-1.5 text-2xl font-display font-bold text-[#F0D9B5]">
                Interview Readiness & Behavioral Assessment
              </h2>
              <p className="mt-2 text-sm text-[#D6C7DF] leading-relaxed max-w-2xl">
                {report.overallVerdict}
              </p>
            </div>

            <div className="shrink-0 rounded-2xl border border-[#6A5ACD]/45 bg-[#1A1A1F] px-6 py-4 text-center">
              <div className="text-xs font-medium text-[#D6C7DF]">
                Overall Score
              </div>
              <div className="mt-1 text-3xl font-bold font-mono tabular-nums text-[#F4A62A]">
                {report.overallScore}/100
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setReport(null);
                setCallState('idle');
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-4 py-2 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/25 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Start New Video Interview</span>
            </button>

            <button
              type="button"
              onClick={onGenerateRecommendations}
              disabled={generatingRecs}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {generatingRecs ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>Rank Career Matches</span>
            </button>
          </div>
        </section>

        {/* Core 4 Evaluation Pillars */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coreDimensions.map((dim) => (
            <div key={dim.key} className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-display font-bold text-[#F0D9B5]">{dim.label}</h3>
                <span className="font-mono tabular-nums text-sm font-bold text-[#F4A62A]">
                  {dim.data.score}/100
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#1A1A1F] overflow-hidden">
                <div
                  className="h-full bg-[#F4A62A] rounded-full"
                  style={{ width: `${Math.min(100, Math.max(5, dim.data.score))}%` }}
                />
              </div>
              <p className="text-xs text-[#D6C7DF] leading-relaxed">{dim.data.feedback}</p>
              {(dim.data?.suggestions?.length ?? 0) > 0 && (
                <ul className="space-y-1.5 pt-3 border-t border-[#6A5ACD]/35">
                  {(dim.data?.suggestions || []).map((tip) => (
                    <li key={tip} className="text-xs text-[#F0D9B5] flex items-start gap-2">
                      <span className="text-[#F4A62A] font-bold">·</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        {/* Supportive Communication & Camera Framing Tips (Non-Scoring) */}
        <section className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-display font-bold text-[#F0D9B5]">
                Supportive Communication &amp; Framing Tips (Non-Scoring)
              </h3>
              <p className="text-xs text-[#D6C7DF] mt-0.5">
                Helpful camera framing and delivery pointers only — VECTORA never evaluates personality, emotions, or intelligence from your camera.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-medium text-emerald-300 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Supportive Guidance Only</span>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {nonVerbalCards.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#F0D9B5]">
                      <Icon className="w-4 h-4 text-[#F4A62A]" />
                      <span>{item.label}</span>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-[#A678B9]">
                      Coaching Tip
                    </span>
                  </div>
                  <p className="text-xs text-[#D6C7DF] leading-relaxed">{item.data.observation}</p>
                  <p className="text-xs text-[#F0D9B5] bg-[#2D2B55]/60 border border-[#6A5ACD]/35 rounded-lg px-3 py-2">
                    <span className="font-semibold text-[#F4A62A]">Tip: </span>
                    {item.data.suggestion}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Follow-Up Probing & Actionable Improvement Plan */}
        <section className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="text-sm font-display font-bold text-[#F0D9B5]">
              Follow-Up Depth & Clarification Handling
            </h3>
            <p className="mt-1.5 text-xs text-[#D6C7DF] leading-relaxed">
              {report.followUpEvaluation}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-[#6A5ACD]/35">
            <div>
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-3">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Key Strengths Observed</span>
              </h4>
              <ul className="space-y-2">
                {(report.keyStrengths || []).map((s) => (
                  <li key={s} className="flex items-start gap-2 text-xs text-[#D6C7DF] leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F0D9B5] mb-3">
                Suggestions for Improvement
              </h4>
              <ul className="space-y-2">
                {(report.improvementPlan || []).map((step) => (
                  <li key={step} className="flex items-start gap-2 text-xs text-[#D6C7DF] leading-relaxed">
                    <ArrowRight className="w-3.5 h-3.5 text-[#F4A62A] shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl overflow-hidden shadow-[0_24px_48px_rgba(12,11,22,0.55)]">
      {callState === 'idle' || callState === 'connecting' ? (
        <div className="p-8 sm:p-10 space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F4A62A]/15 border border-[#F4A62A]/45 text-[#F4A62A] flex items-center justify-center">
              <Video className="w-6 h-6" />
            </div>
            <div className="max-w-xl mx-auto space-y-2">
              <h2 className="text-xl font-display font-bold text-[#F0D9B5]">
                VECTORA Live AI Career Guidance Call
              </h2>
              <p className="text-xs sm:text-sm text-[#D6C7DF] leading-relaxed">
                This friendly 10-topic conversation explores your interests, favourite subjects, problem-solving style, and future goals. There are no trick questions or right/wrong answers.
              </p>
            </div>
          </div>

          <div className="max-w-xl mx-auto rounded-2xl border border-[#F4A62A]/40 bg-[#1A1A1F] p-4 space-y-2">
            <div className="text-[11px] font-mono font-semibold text-[#F4A62A]">
              VECTORA AI Greeting Preview
            </div>
            <p className="text-xs text-[#F0D9B5] italic leading-relaxed">
              &ldquo;Hello! Welcome to VECTORA. I&apos;m your personal career guidance assistant. Don&apos;t worry, this isn&apos;t an examination, and there are no right or wrong answers. I am here to understand your interests, strengths, and the kind of future you imagine for yourself. Let&apos;s have a friendly conversation. Are you ready to begin?&rdquo;
            </p>
          </div>

          <div className="max-w-xl mx-auto rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F]/70 px-4 py-3 text-xs text-[#D6C7DF] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Consent &amp; Comfort:</strong> Microphone access lets you speak naturally. Optional webcam framing only provides supportive communication tips — you may also join in Voice-Only mode anytime.
            </span>
          </div>

          {errorMsg && (
            <div className="max-w-md mx-auto rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-2.5 text-xs text-red-200 text-center">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => startVideoInterview(false)}
              disabled={callState === 'connecting'}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-6 py-3 text-sm font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-60 transition-colors shadow-[0_0_24px_rgba(244,166,42,0.22)]"
            >
              {callState === 'connecting' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Video className="w-4 h-4" />
              )}
              <span>{callState === 'connecting' ? 'Connecting Camera & Mic...' : 'Allow Mic & Camera · Start Call'}</span>
            </button>

            <button
              type="button"
              onClick={() => startVideoInterview(true)}
              disabled={callState === 'connecting'}
              className="inline-flex items-center gap-2 rounded-xl border border-[#6A5ACD]/60 bg-[#1A1A1F] px-5 py-3 text-xs sm:text-sm font-semibold text-[#F0D9B5] hover:border-[#F4A62A] disabled:opacity-60 transition-colors"
            >
              <Mic className="w-4 h-4 text-[#F4A62A]" />
              <span>Voice-Only Mode</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Top Video Call Header Bar */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-[#1A1A1F] text-[#F0D9B5] border-b border-[#6A5ACD]/35">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="font-semibold">VECTORA AI Interviewer</span>
              <span className="text-[#A678B9]">·</span>
              <span className="rounded-md bg-[#2D2B55] border border-[#6A5ACD]/50 px-2 py-0.5 font-mono text-[11px] text-[#F0D9B5]">
                Topic {Math.min(10, Math.max(1, turns.filter((t) => t.speaker === 'You').length + 1))}/10
              </span>
              <span className="text-[#A678B9]">·</span>
              <span className="font-mono tabular-nums text-[#F4A62A]">
                {formatDuration(elapsedSeconds)}
              </span>
            </div>
            <div className="text-xs text-[#D6C7DF]">
              {aiSpeaking ? 'Interviewer is speaking...' : muted ? 'Microphone muted' : 'Listening to you...'}
            </div>
          </div>

          {/* 2-Participant Video Call Stage */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-[#222042]">
            {/* AI Interviewer Tile */}
            <div className="md:col-span-7 relative rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/45 aspect-video flex flex-col items-center justify-center p-6 overflow-hidden">
              <div className="relative flex items-center justify-center">
                <div
                  className={`w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                    aiSpeaking
                      ? 'border-[#F4A62A] bg-[#F4A62A]/15 scale-105 shadow-[0_0_32px_rgba(244,166,42,0.35)]'
                      : 'border-[#6A5ACD]/60 bg-[#2D2B55]'
                  }`}
                >
                  <Volume2 className={`w-9 h-9 ${aiSpeaking ? 'text-[#F4A62A]' : 'text-[#A678B9]'}`} />
                </div>
              </div>

              <div className="mt-4 text-center">
                <div className="text-sm font-display font-bold text-[#F0D9B5]">Vectora Interviewer</div>
                <div className="text-xs text-[#D6C7DF] mt-0.5">
                  {aiSpeaking ? 'Asking question via voice' : 'Listening & observing video feed'}
                </div>
              </div>

              {latestAiCaption && (
                <div className="mt-4 max-w-md rounded-xl bg-[#2D2B55]/95 border border-[#6A5ACD]/45 px-3.5 py-2.5 text-xs text-[#F0D9B5] text-center leading-relaxed line-clamp-3">
                  “{latestAiCaption}”
                </div>
              )}
            </div>

            {/* Student Live Webcam Tile */}
            <div className="md:col-span-5 relative rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/45 aspect-video md:aspect-auto md:min-h-[260px] overflow-hidden flex items-center justify-center">
              {cameraAvailable && cameraOn ? (
                <video
                  ref={videoElRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="p-4 text-center space-y-2">
                  <CameraOff className="w-7 h-7 text-[#A678B9] mx-auto" />
                  <p className="text-xs text-[#D6C7DF]">
                    {cameraAvailable ? 'Camera paused' : 'Microphone-only mode (no webcam detected)'}
                  </p>
                </div>
              )}

              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 rounded-lg bg-[#1A1A1F]/90 border border-[#6A5ACD]/45 px-3 py-1.5">
                <span className="text-xs font-medium text-[#F0D9B5] truncate">{profile.fullName}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 h-1.5 rounded-full bg-[#2D2B55] overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                  {muted ? (
                    <MicOff className="w-3.5 h-3.5 text-[#F4A62A]" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Call Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#1A1A1F] border-t border-[#6A5ACD]/35">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                  muted
                    ? 'bg-[#F4A62A] text-[#1A1A1F] hover:bg-[#F7B64C]'
                    : 'bg-[#2D2B55] text-[#F0D9B5] hover:bg-[#6A5ACD]/30 border border-[#6A5ACD]/50'
                }`}
              >
                {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{muted ? 'Unmute Mic' : 'Mute Mic'}</span>
              </button>

              {cameraAvailable && (
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors border ${
                    !cameraOn
                      ? 'bg-[#6A5ACD]/30 text-[#F0D9B5] border-[#A678B9]/55'
                      : 'bg-[#2D2B55] text-[#F0D9B5] hover:bg-[#6A5ACD]/30 border-[#6A5ACD]/50'
                  }`}
                >
                  {cameraOn ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
                  <span>{cameraOn ? 'Turn Camera Off' : 'Turn Camera On'}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleEndAndGenerateReport}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 transition-colors"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>End Interview & Generate Report</span>
            </button>
          </div>

          {/* Live Speech-to-Text Internal Log */}
          <div className="p-5 bg-[#2D2B55] border-t border-[#6A5ACD]/35 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#F0D9B5] flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#F4A62A]" />
                <span>Live Speech-to-Text Transcript</span>
              </span>
              <span className="text-[#D6C7DF]">Speak freely — answers transcribe automatically</span>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-xl border border-[#6A5ACD]/40 bg-[#1A1A1F] p-3.5 space-y-2 text-xs">
              {turns.length === 0 ? (
                <p className="text-[#A678B9]/80">
                  Waiting for the interviewer greeting... speak into your microphone as soon as they finish.
                </p>
              ) : (
                turns.map((t) => (
                  <div key={t.id} className="leading-relaxed">
                    <span
                      className={`font-semibold ${
                        t.speaker === 'You' ? 'text-[#F4A62A]' : 'text-emerald-400'
                      }`}
                    >
                      {t.speaker}:{' '}
                    </span>
                    <span className="text-[#F0D9B5]">{t.text}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  sendQuickInterviewSignal(
                    'Could you please explain that question a little more simply or give an example?'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3 py-1.5 text-[11px] font-medium text-[#F0D9B5] hover:border-[#F4A62A] transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#F4A62A]" />
                <span>Explain Differently</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  sendQuickInterviewSignal(
                    'I would like to pass this question for now and move to the next topic.'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3 py-1.5 text-[11px] font-medium text-[#D6C7DF] hover:border-[#A678B9] hover:text-[#F0D9B5] transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5 text-[#A678B9]" />
                <span>Pass Question for Now</span>
              </button>
            </div>

            <form onSubmit={handleSendOptionalText} className="flex gap-2">
              <input
                type="text"
                value={optionalText}
                onChange={(e) => setOptionalText(e.target.value)}
                placeholder="Optional: type a clarification if your mic is muted..."
                className="flex-1 rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2 text-xs text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A]"
              />
              <button
                type="submit"
                disabled={!optionalText.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3.5 py-2 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/25 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Note</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
