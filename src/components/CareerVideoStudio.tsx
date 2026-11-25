import React, { useEffect, useRef, useState } from 'react';
import { Film, ImagePlus, Loader2, Play, Sparkles, Trash2 } from 'lucide-react';
import { fetchCareerVideos, generateCareerVideo } from '../api/client';
import type { CareerDefinition, CareerVideoItem } from '../types';

interface CareerVideoStudioProps {
  career: CareerDefinition;
}

export const CareerVideoStudio: React.FC<CareerVideoStudioProps> = ({ career }) => {
  const [studioMode, setStudioMode] = useState<'text' | 'image'>('text');
  const [prompt, setPrompt] = useState(
    `A cinematic documentary glimpse into a day in the life of a ${career.title}: collaborating in a modern studio, reviewing ${career.dailySimulationContext}, natural morning window light, realistic camera movement.`
  );
  const [motionPrompt, setMotionPrompt] = useState(
    `Subtle cinematic camera push-in with natural atmospheric movement, ambient light shifts across the ${career.domain.toLowerCase()} workspace, realistic depth and motion.`
  );
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [uploadedImage, setUploadedImage] = useState<{
    dataUrl: string;
    base64: string;
    mimeType: string;
    fileName: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<CareerVideoItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<CareerVideoItem | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrompt(
      `A cinematic documentary glimpse into a day in the life of a ${career.title}: collaborating in a modern studio, reviewing ${career.dailySimulationContext}, natural morning window light, realistic camera movement.`
    );
    setMotionPrompt(
      `Subtle cinematic camera push-in with natural atmospheric movement, ambient light shifts across the ${career.domain.toLowerCase()} workspace, realistic depth and motion.`
    );
  }, [career.id, career.title, career.dailySimulationContext, career.domain]);

  useEffect(() => {
    let mounted = true;
    setLoadingList(true);
    fetchCareerVideos()
      .then((res) => {
        if (!mounted) return;
        setVideos(res.videos);
        if (res.videos.length > 0) {
          setActiveVideo(res.videos[0]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingList(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleImageFile = (file: File | undefined) => {
    if (!file) return;
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PNG, JPEG, or WebP image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be 10 MB or smaller.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1] || '';
      if (!base64) {
        setError('Could not read the selected image file.');
        return;
      }
      setUploadedImage({
        dataUrl,
        base64,
        mimeType: file.type,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async (e: React.FormEvent, followUpInstruction?: string) => {
    e.preventDefault();
    const activePrompt = followUpInstruction
      ? followUpInstruction.trim()
      : studioMode === 'image'
        ? motionPrompt.trim()
        : prompt.trim();

    if (!activePrompt || generating) return;
    if (!followUpInstruction && studioMode === 'image' && !uploadedImage) {
      setError('Upload a reference photo first to animate it into video.');
      return;
    }

    setError(null);
    setGenerating(true);
    try {
      const res = await generateCareerVideo({
        careerId: career.id,
        prompt: activePrompt,
        aspectRatio,
        previousInteractionId: followUpInstruction ? activeVideo?.interactionId || undefined : undefined,
        imageBase64: !followUpInstruction && studioMode === 'image' ? uploadedImage?.base64 : undefined,
        imageMimeType: !followUpInstruction && studioMode === 'image' ? uploadedImage?.mimeType : undefined,
      });
      setVideos((prev) => [res.video, ...prev]);
      setActiveVideo(res.video);
      if (followUpInstruction) setEditPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl overflow-hidden shadow-[0_24px_48px_rgba(12,11,22,0.55)]">
      {/* Studio Top Bar */}
      <div className="px-6 py-5 border-b border-[#6A5ACD]/35 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-lg bg-[#F4A62A]/15 border border-[#F4A62A]/45 text-[#F4A62A] flex items-center justify-center shrink-0">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-mono font-medium text-[#F4A62A]">
              Video Preview Studio
            </div>
            <h2 className="text-lg font-display font-bold text-[#F0D9B5]">
              Visualize {career.title} in Motion
            </h2>
            <p className="text-xs text-[#D6C7DF] mt-0.5">
              Generate a 16:9 or 9:16 scene from text, or animate an uploaded workspace/portfolio photo into video.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          {/* Generation Mode Switcher */}
          <div className="inline-flex items-center p-1 bg-[#1A1A1F] border border-[#6A5ACD]/45 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setStudioMode('text');
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                studioMode === 'text'
                  ? 'bg-[#F4A62A] text-[#1A1A1F]'
                  : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
              }`}
            >
              Text to Video
            </button>
            <button
              type="button"
              onClick={() => {
                setStudioMode('image');
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                studioMode === 'image'
                  ? 'bg-[#F4A62A] text-[#1A1A1F]'
                  : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
              }`}
            >
              Animate Photo
            </button>
          </div>

          {/* Aspect Ratio Switcher */}
          <div className="inline-flex items-center p-1 bg-[#1A1A1F] border border-[#6A5ACD]/45 rounded-lg">
            <button
              type="button"
              onClick={() => setAspectRatio('16:9')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                aspectRatio === '16:9'
                  ? 'bg-[#6A5ACD]/40 text-[#F0D9B5] border border-[#A678B9]/55'
                  : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
              }`}
            >
              16:9 Landscape
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio('9:16')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                aspectRatio === '9:16'
                  ? 'bg-[#6A5ACD]/40 text-[#F0D9B5] border border-[#A678B9]/55'
                  : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
              }`}
            >
              9:16 Portrait
            </button>
          </div>
        </div>
      </div>

      {/* Studio 12-Col Split Workspace */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form onSubmit={(e) => handleGenerate(e)} className="lg:col-span-6 space-y-5">
          {studioMode === 'image' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#F0D9B5]">
                  Starting Frame Photo (PNG, JPEG, WebP)
                </label>
                {uploadedImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedImage(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#D6C7DF] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove photo</span>
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => handleImageFile(e.target.files?.[0])}
                className="hidden"
              />

              {uploadedImage ? (
                <div className="flex items-center gap-4 rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] p-3">
                  <img
                    src={uploadedImage.dataUrl}
                    alt="Uploaded starting frame"
                    className="w-24 h-16 object-cover rounded-lg border border-[#6A5ACD]/45 shrink-0 bg-[#1A1A1F]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#F0D9B5] truncate">
                      {uploadedImage.fileName}
                    </div>
                    <div className="text-xs text-[#D6C7DF] mt-0.5">
                      Ready to animate into {aspectRatio} video
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg border border-[#6A5ACD]/55 bg-[#2D2B55] px-3 py-1.5 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/30 shrink-0"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleImageFile(e.dataTransfer.files?.[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                  }}
                  className="cursor-pointer rounded-xl border border-dashed border-[#6A5ACD]/65 bg-[#1A1A1F]/85 hover:border-[#F4A62A] hover:bg-[#F4A62A]/10 transition-colors p-6 text-center space-y-2"
                >
                  <ImagePlus className="w-6 h-6 text-[#F4A62A] mx-auto" />
                  <div className="text-xs font-semibold text-[#F0D9B5]">
                    Click to upload or drop a photo to animate
                  </div>
                  <div className="text-xs text-[#D6C7DF]">
                    Sketch, lab setup, prototype, or campus scene (PNG, JPG, WebP up to 10 MB)
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">
              {studioMode === 'image' ? 'Motion & Camera Direction' : 'Scene Prompt'}
            </label>
            <textarea
              rows={studioMode === 'image' ? 3 : 4}
              value={studioMode === 'image' ? motionPrompt : prompt}
              onChange={(e) =>
                studioMode === 'image' ? setMotionPrompt(e.target.value) : setPrompt(e.target.value)
              }
              placeholder={
                studioMode === 'image'
                  ? 'Describe how the camera and elements in your photo should move...'
                  : 'Describe the career scene you want to visualize...'
              }
              className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A] transition-colors"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/60 px-3.5 py-2.5 text-xs text-red-200 leading-relaxed">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              generating ||
              (studioMode === 'text' ? !prompt.trim() : !motionPrompt.trim() || !uploadedImage)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-5 py-2.5 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-55 transition-colors whitespace-nowrap"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>
              {generating
                ? 'Rendering Video Clip (~30–90s)...'
                : studioMode === 'image'
                  ? `Animate Photo (${aspectRatio})`
                  : `Generate ${aspectRatio} Career Video`}
            </span>
          </button>

          {activeVideo?.interactionId && (
            <div className="pt-5 border-t border-[#6A5ACD]/35 space-y-2">
              <label className="block text-xs font-semibold text-[#F0D9B5]">
                Multi-Turn Video Edit / Extension
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g. Pan camera toward the engineering workbench..."
                  className="flex-1 rounded-lg border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-xs text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A]"
                />
                <button
                  type="button"
                  disabled={generating || !editPrompt.trim()}
                  onClick={(e) => handleGenerate(e, editPrompt)}
                  className="rounded-lg border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3.5 py-2 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/25 disabled:opacity-50 whitespace-nowrap transition-colors"
                >
                  Apply Edit
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Playback Monitor */}
        <div className="lg:col-span-6 space-y-4">
          {activeVideo ? (
            <div className="space-y-2.5">
              <div
                className={`overflow-hidden rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] flex items-center justify-center ${
                  activeVideo.aspectRatio === '9:16'
                    ? 'max-h-[420px] mx-auto aspect-[9/16]'
                    : 'aspect-video w-full'
                }`}
              >
                <video
                  key={activeVideo.id}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                  src={`data:${activeVideo.mimeType};base64,${activeVideo.videoDataBase64}`}
                />
              </div>
              <div className="flex items-start justify-between gap-4 text-xs text-[#D6C7DF]">
                <span className="leading-relaxed">
                  {activeVideo.prompt.slice(0, 120)}
                  {activeVideo.prompt.length > 120 ? '...' : ''}
                </span>
                <span className="font-mono tabular-nums text-[#F4A62A] font-medium shrink-0">
                  {activeVideo.aspectRatio}
                </span>
              </div>
            </div>
          ) : (
            <div className="aspect-video rounded-xl border border-dashed border-[#6A5ACD]/55 bg-[#1A1A1F]/80 flex flex-col items-center justify-center p-8 text-center">
              {loadingList ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#F4A62A]" />
              ) : (
                <>
                  <div className="w-11 h-11 rounded-full bg-[#2D2B55] border border-[#6A5ACD]/50 flex items-center justify-center">
                    <Play className="w-5 h-5 text-[#F4A62A] ml-0.5" />
                  </div>
                  <p className="mt-3 text-xs text-[#D6C7DF] max-w-xs leading-relaxed">
                    Generate a 16:9 or 9:16 scene from text, or switch to Animate Photo to bring a snapshot to life.
                  </p>
                </>
              )}
            </div>
          )}

          {videos.length > 1 && (
            <div className="pt-2 border-t border-[#6A5ACD]/35 space-y-2">
              <div className="text-xs font-semibold text-[#F0D9B5]">Saved Studio Clips</div>
              <div className="flex flex-wrap gap-2">
                {videos.map((v, idx) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setActiveVideo(v)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium font-mono tabular-nums transition-colors ${
                      activeVideo?.id === v.id
                        ? 'border-[#F4A62A]/75 bg-[#F4A62A]/15 text-[#F4A62A] font-semibold'
                        : 'border-[#6A5ACD]/45 bg-[#1A1A1F] text-[#D6C7DF] hover:bg-[#6A5ACD]/25'
                    }`}
                  >
                    Clip {videos.length - idx} ({v.aspectRatio})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
