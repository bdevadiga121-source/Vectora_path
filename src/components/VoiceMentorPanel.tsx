import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { getActiveIdToken } from '../api/client';

interface VoiceMentorPanelProps {
  contextMode: string;
  careerTitle: string;
  dark?: boolean;
}

interface TranscriptEntry {
  id: string;
  speaker: 'You' | 'AI Voice';
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

export const VoiceMentorPanel: React.FC<VoiceMentorPanelProps> = ({
  contextMode,
  careerTitle,
  dark = false,
}) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);

  // Refs to prevent stale closures inside audio callbacks
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mutedRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  mutedRef.current = muted;

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
  };

  const cleanupSession = () => {
    stopPlaybackQueue();
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
    setStatus('idle');
  };

  useEffect(() => {
    return () => {
      cleanupSession();
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

    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
  };

  const appendTranscript = (speaker: 'You' | 'AI Voice', text: string) => {
    if (!text.trim()) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text} ${text}`.trim() },
        ];
      }
      return [...prev, { id: `tr_${Date.now()}_${Math.random()}`, speaker, text }];
    });
  };

  const startVoiceSession = async () => {
    setErrorMsg(null);
    setStatus('connecting');
    try {
      const token = await getActiveIdToken();
      if (!token) {
        throw new Error('Please sign in first to start a live voice conversation.');
      }

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live?token=${encodeURIComponent(token)}&context=${encodeURIComponent(contextMode)}&career=${encodeURIComponent(careerTitle)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (ev) => {
          if (mutedRef.current || ws.readyState !== WebSocket.OPEN) return;
          const channelData = ev.inputBuffer.getChannelData(0);
          const base64 = pcmFloat32ToBase64(channelData);
          ws.send(JSON.stringify({ audio: base64 }));
        };
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.ready) {
          setStatus('live');
        }
        if (msg.error) {
          setErrorMsg(msg.error);
          setStatus('error');
          cleanupSession();
          return;
        }
        if (msg.audio) {
          playPcmChunk(msg.audio);
        }
        if (msg.interrupted) {
          stopPlaybackQueue();
        }
        if (msg.inputTranscript) {
          appendTranscript('You', msg.inputTranscript);
        }
        if (msg.outputTranscript) {
          appendTranscript('AI Voice', msg.outputTranscript);
        }
      };

      ws.onerror = () => {
        setErrorMsg('Voice WebSocket connection failed.');
        setStatus('error');
        cleanupSession();
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          cleanupSession();
        }
      };
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Microphone or Live API error');
      setStatus('error');
      cleanupSession();
    }
  };

  const containerCls = dark
    ? 'rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] p-4 text-[#F0D9B5]'
    : 'rounded-2xl border border-[#6A5ACD]/45 bg-[#2D2B55] p-5 text-[#F0D9B5]';

  return (
    <div className={containerCls}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Volume2 className="w-4 h-4 text-[#F4A62A]" />
          <div>
            <div className="text-xs font-display font-bold text-[#F0D9B5]">Live Voice Conversation</div>
            <div className="text-xs text-[#D6C7DF]">
              Real-time speech · {contextMode}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'live' ? (
            <>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  muted
                    ? 'bg-[#F4A62A] text-[#1A1A1F] hover:bg-[#F7B64C]'
                    : 'bg-[#2D2B55] text-[#F0D9B5] hover:bg-[#6A5ACD]/30 border border-[#6A5ACD]/50'
                }`}
              >
                {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{muted ? 'Unmute' : 'Mute'}</span>
              </button>
              <button
                type="button"
                onClick={cleanupSession}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startVoiceSession}
              disabled={status === 'connecting'}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4A62A] px-3.5 py-1.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {status === 'connecting' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
              <span>{status === 'connecting' ? 'Connecting...' : 'Start Voice Call'}</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs text-red-200">
          {errorMsg}
        </div>
      )}

      {transcripts.length > 0 && (
        <div className="mt-3 max-h-40 overflow-y-auto space-y-2 rounded-lg p-3 text-xs bg-[#2D2B55] border border-[#6A5ACD]/45">
          {transcripts.map((t) => (
            <div key={t.id}>
              <span className={`font-semibold ${t.speaker === 'You' ? 'text-[#F4A62A]' : 'text-emerald-400'}`}>
                {t.speaker}:{' '}
              </span>
              <span className="text-[#F0D9B5]">{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
