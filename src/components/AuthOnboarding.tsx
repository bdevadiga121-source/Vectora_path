import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Video,
} from 'lucide-react';
import {
  formatAuthError,
  resetPasswordEmail,
  signInWithEmail,
  signInWithGooglePopup,
  signUpWithEmail,
} from '../api/client';
import type { AuthSession, EducationStage, StudentProfile, StudentWorkspaceState } from '../types';

interface AuthOnboardingProps {
  mode: 'auth' | 'profile';
  initialProfile: StudentProfile | null;
  onAuthSuccess: (session: AuthSession, workspace: StudentWorkspaceState) => void;
  onProfileComplete: (profile: StudentProfile) => void;
  onGoToAdminLogin?: () => void;
}

const EDUCATION_STAGES: EducationStage[] = [
  '10th Standard',
  '11th Standard',
  '12th Standard',
  'First Year College',
  'Second & Third Year',
  'Final Year',
  'Graduate / Early Career',
];

const STREAMS = [
  'Science & Mathematics (PCM)',
  'Life Sciences & Biology (PCB / PCMB)',
  'Commerce, Finance & Economics',
  'Humanities, Law & Social Sciences',
  'Design, Architecture & Media',
];

const SUBJECT_OPTIONS = [
  'Mathematics',
  'Computer Science',
  'Physics',
  'Biology',
  'Chemistry',
  'Economics',
  'Visual Design',
  'Literature & Debate',
  'Environmental Science',
  'Statistics',
];

const SHOWCASE_SLIDES = [
  {
    image: '/src/assets/images/login_cosmic_horizon_1795603043051.jpg',
    alt: 'Twilight mountain observatory overlooking a golden horizon',
    title: 'Aerospace & AI Systems',
    subtitle: '5-Stage Roadmap · 3D Lab',
    icon: Compass,
  },
  {
    image: '/src/assets/images/futuristic_campus_observatory_1795363329285.jpg',
    alt: 'Futuristic research campus observatory at dusk',
    title: 'Autonomous Robotics Track',
    subtitle: 'AI Ability Check · Voice Call',
    icon: Cpu,
  },
  {
    image: '/src/assets/images/futuristic_studio_console_1795363328519.jpg',
    alt: 'Futuristic studio engineering console',
    title: 'Computational Media & UX',
    subtitle: 'Live Interview · Video Studio',
    icon: Video,
  },
];

export const AuthOnboarding: React.FC<AuthOnboardingProps> = ({
  mode,
  initialProfile,
  onAuthSuccess,
  onProfileComplete,
  onGoToAdminLogin,
}) => {
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [slideIndex, setSlideIndex] = useState(0);

  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [fullName, setFullName] = useState(initialProfile?.fullName || '');
  const [educationStage, setEducationStage] = useState<EducationStage>(
    initialProfile?.educationStage || '12th Standard'
  );
  const [academicStream, setAcademicStream] = useState(
    initialProfile?.academicStream || STREAMS[0]
  );
  const [topSubjects, setTopSubjects] = useState<string[]>(
    initialProfile?.topSubjects?.length ? initialProfile.topSubjects : ['Mathematics', 'Computer Science']
  );
  const [curiosities, setCuriosities] = useState(initialProfile?.curiosities || '');
  const [workPreference, setWorkPreference] = useState(
    initialProfile?.workPreference || 'Building interactive systems and solving analytical problems'
  );
  const [longTermGoal, setLongTermGoal] = useState(initialProfile?.longTermGoal || '');

  const switchAuthTab = (next: 'signin' | 'signup') => {
    setAuthTab(next);
    setError(null);
    setNotice(null);
  };

  const handlePrevSlide = () => {
    setSlideIndex((prev) => (prev - 1 + SHOWCASE_SLIDES.length) % SHOWCASE_SLIDES.length);
  };

  const handleNextSlide = () => {
    setSlideIndex((prev) => (prev + 1) % SHOWCASE_SLIDES.length);
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await signInWithGooglePopup();
      onAuthSuccess(res.user, res.workspace);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!authEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!authPassword || authPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (authTab === 'signup' && !authName.trim()) {
      setError('Please enter your full name to create your account.');
      return;
    }

    setLoading(true);
    try {
      const res =
        authTab === 'signin'
          ? await signInWithEmail(authEmail, authPassword)
          : await signUpWithEmail(authName, authEmail, authPassword);
      onAuthSuccess(res.user, res.workspace);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);
    if (!authEmail.trim()) {
      setError('Enter your email address above first so we can send a reset link.');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordEmail(authEmail);
      setNotice(`Password reset instructions sent to ${authEmail.trim()}.`);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (subj: string) => {
    setTopSubjects((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj].slice(0, 5)
    );
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your name.');
      return;
    }
    onProfileComplete({
      ...initialProfile,
      fullName: fullName.trim(),
      email: initialProfile?.email || 'student@vectora.edu',
      educationStage,
      classGrade: educationStage,
      academicStream,
      topSubjects: topSubjects.length ? topSubjects : ['Mathematics'],
      curiosities: curiosities.trim() || 'Exploring real-world careers and interactive projects',
      workPreference: workPreference.trim(),
      longTermGoal: longTermGoal.trim() || 'Find a fulfilling, high-growth career pathway',
    });
  };

  if (mode === 'profile') {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-between bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-8 shadow-[0_24px_48px_rgba(10,8,20,0.45)]">
            <div>
              <div className="text-xs font-mono font-medium text-[#F4A62A]">
                02 · Student Profile Calibration
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-display font-bold text-[#F0D9B5] text-balance leading-tight">
                Calibrate your academic baseline before the assessment
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#D6C7DF]">
                Your education stage, strongest subjects, and natural curiosities shape the AI Ability Questions, interview probes, and ranked career pathways.
              </p>
              <div className="mt-7 overflow-hidden rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] aspect-[4/3]">
                <img
                  src="/src/assets/images/futuristic_studio_console_1795363328519.jpg"
                  alt="Academic drafting workstation inside a twilight observatory"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="mt-6 pt-5 border-t border-[#6A5ACD]/35 text-xs text-[#D6C7DF] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#F4A62A] shrink-0" />
              <span>Persisted securely to your PostgreSQL student workspace</span>
            </div>
          </div>

          <form
            onSubmit={handleProfileSubmit}
            className="lg:col-span-7 bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-8 space-y-6 shadow-[0_24px_48px_rgba(10,8,20,0.45)]"
          >
            <div className="border-b border-[#6A5ACD]/35 pb-4">
              <h2 className="text-lg font-display font-bold text-[#F0D9B5]">Academic & Personal Context</h2>
              <p className="text-xs text-[#D6C7DF] mt-0.5">
                All fields can be refined later as your skills evolve.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A] transition-colors"
                  placeholder="e.g. Aarav Sharma"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">Current Education Stage</label>
                <select
                  value={educationStage}
                  onChange={(e) => setEducationStage(e.target.value as EducationStage)}
                  className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A] transition-colors"
                >
                  {EDUCATION_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">Academic Stream</label>
              <select
                value={academicStream}
                onChange={(e) => setAcademicStream(e.target.value)}
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A] transition-colors"
              >
                {STREAMS.map((stream) => (
                  <option key={stream} value={stream}>
                    {stream}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-[#F0D9B5]">Strongest Subjects (select up to 5)</label>
                <span className="text-xs font-mono tabular-nums text-[#F4A62A]">{topSubjects.length}/5 selected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_OPTIONS.map((subj) => {
                  const active = topSubjects.includes(subj);
                  return (
                    <button
                      type="button"
                      key={subj}
                      onClick={() => toggleSubject(subj)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#F4A62A] text-[#1A1A1F] border-[#F4A62A] font-semibold'
                          : 'bg-[#1A1A1F] text-[#D6C7DF] border-[#6A5ACD]/45 hover:border-[#A678B9] hover:text-[#F0D9B5]'
                      }`}
                    >
                      {subj}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">
                What topics or problems make you curious?
              </label>
              <input
                type="text"
                value={curiosities}
                onChange={(e) => setCuriosities(e.target.value)}
                placeholder="e.g. How autonomous drones navigate, clinical diagnostics, or financial markets"
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A] transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">Preferred Working Style</label>
                <input
                  type="text"
                  value={workPreference}
                  onChange={(e) => setWorkPreference(e.target.value)}
                  className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">Long-Term Aspiration</label>
                <input
                  type="text"
                  value={longTermGoal}
                  onChange={(e) => setLongTermGoal(e.target.value)}
                  placeholder="e.g. Lead impactful engineering or research teams"
                  className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/35 focus:border-[#F4A62A] transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-2.5 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-4 border-t border-[#6A5ACD]/35 flex items-center justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-6 py-3 text-sm font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors whitespace-nowrap shrink-0"
              >
                <span>Save Profile & Start AI Questions</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const activeSlide = SHOWCASE_SLIDES[slideIndex];
  const SlideIcon = activeSlide.icon;

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-8 lg:py-10 overflow-hidden bg-[linear-gradient(108deg,rgba(26,26,31,0.96)_0%,rgba(26,26,31,0.96)_52%,rgba(45,43,85,0.42)_52.2%,rgba(45,43,85,0.42)_100%)]">
      {/* Centered Split-Card Login Shell */}
      <div className="relative z-10 w-full max-w-5xl rounded-[28px] bg-[#2D2B55] border border-[#6A5ACD]/50 border-t-[#A678B9]/55 p-3 sm:p-4 shadow-[0_32px_80px_rgba(8,6,18,0.68)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch gap-3 sm:gap-4">
          {/* Left Visual Showcase Panel */}
          <div className="lg:col-span-6 relative min-h-[380px] sm:min-h-[460px] lg:min-h-[600px] rounded-[20px] overflow-hidden bg-[#1A1A1F] border border-[#6A5ACD]/35 flex flex-col justify-between">
            <img
              key={activeSlide.image}
              src={activeSlide.image}
              alt={activeSlide.alt}
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
            />
            {/* Measured Top & Bottom Scrims */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#1A1A1F]/75 via-transparent to-[#1A1A1F]/95 pointer-events-none" />

            {/* Showcase Top Overlay Bar */}
            <div className="relative z-10 flex items-center justify-between px-6 pt-6 gap-4">
              <span className="text-sm font-medium tracking-tight text-[#F0D9B5] whitespace-nowrap">
                Featured Tracks
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => switchAuthTab('signup')}
                  className={`text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    authTab === 'signup' ? 'text-[#F4A62A]' : 'text-[#F0D9B5]/85 hover:text-[#F0D9B5]'
                  }`}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => switchAuthTab(authTab === 'signin' ? 'signup' : 'signin')}
                  className="rounded-full border border-[#F0D9B5]/60 bg-[#1A1A1F]/45 px-4 py-1.5 text-xs font-medium text-[#F0D9B5] hover:border-[#F4A62A] hover:text-[#F4A62A] transition-colors whitespace-nowrap shrink-0"
                >
                  {authTab === 'signin' ? 'Join Us' : 'Sign In'}
                </button>
              </div>
            </div>

            {/* Showcase Bottom Spotlight & Controls */}
            <div className="relative z-10 flex items-end justify-between gap-4 px-6 pb-6">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-full bg-[#2D2B55] border border-[#F4A62A]/65 flex items-center justify-center shrink-0 shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
                  <SlideIcon className="w-5 h-5 text-[#F4A62A]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-display font-semibold text-[#F0D9B5] truncate">
                    {activeSlide.title}
                  </div>
                  <div className="text-xs text-[#D6C7DF] truncate">
                    {activeSlide.subtitle}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrevSlide}
                  aria-label="Previous featured pathway"
                  className="w-9 h-9 rounded-full border border-[#F0D9B5]/45 bg-[#1A1A1F]/55 flex items-center justify-center text-[#F0D9B5] hover:border-[#F4A62A] hover:text-[#F4A62A] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  aria-label="Next featured pathway"
                  className="w-9 h-9 rounded-full border border-[#F0D9B5]/45 bg-[#1A1A1F]/55 flex items-center justify-center text-[#F0D9B5] hover:border-[#F4A62A] hover:text-[#F4A62A] transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Auth Form Panel */}
          <div className="lg:col-span-6 flex flex-col justify-between px-4 py-6 sm:px-9 sm:py-8">
            {/* Panel Header Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-base font-display font-bold tracking-tight text-[#F0D9B5] whitespace-nowrap">
                Vectora
              </span>
              <div className="inline-flex items-center rounded-full bg-[#1A1A1F] border border-[#6A5ACD]/45 p-1">
                <button
                  type="button"
                  onClick={() => switchAuthTab('signin')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    authTab === 'signin'
                      ? 'bg-[#F4A62A] text-[#1A1A1F]'
                      : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchAuthTab('signup')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    authTab === 'signup'
                      ? 'bg-[#F4A62A] text-[#1A1A1F]'
                      : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            {/* Center Form Block */}
            <div className="w-full max-w-sm mx-auto my-auto py-8">
              <div className="text-center">
                <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-[#F0D9B5] text-balance">
                  {authTab === 'signin' ? 'Welcome Back' : 'Start Exploring'}
                </h1>
                <p className="mt-2 text-sm text-[#D6C7DF]">
                  {authTab === 'signin'
                    ? 'Sign in to access your Student Dashboard & Vectora roadmap'
                    : 'Create your student account to evaluate abilities & careers'}
                </p>
              </div>

              <form onSubmit={handleEmailAuthSubmit} className="mt-8 space-y-3.5">
                {authTab === 'signup' && (
                  <div>
                    <label htmlFor="auth-fullname" className="sr-only">
                      Full Name
                    </label>
                    <input
                      id="auth-fullname"
                      type="text"
                      autoComplete="name"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-4 py-3 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/40 focus:border-[#F4A62A] transition-colors"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="sr-only">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-4 py-3 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/40 focus:border-[#F4A62A] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="auth-password" className="sr-only">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={authTab === 'signin' ? 'current-password' : 'new-password'}
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] pl-4 pr-11 py-3 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/40 focus:border-[#F4A62A] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A678B9] hover:text-[#F0D9B5] p-1 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authTab === 'signin' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={loading}
                      className="text-xs font-medium text-[#F4A62A] hover:text-[#F7B64C] transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-red-400/50 bg-red-950/60 px-3.5 py-2.5 text-xs text-red-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-300" />
                    <span>{error}</span>
                  </div>
                )}

                {notice && (
                  <div className="rounded-xl border border-emerald-400/50 bg-emerald-950/50 px-3.5 py-2.5 text-xs text-emerald-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-300" />
                    <span>{notice}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 py-1.5">
                  <div className="h-px flex-1 bg-[#6A5ACD]/35" />
                  <span className="text-xs text-[#D6C7DF]">or</span>
                  <div className="h-px flex-1 bg-[#6A5ACD]/35" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[#6A5ACD]/60 bg-[#1A1A1F] px-4 py-3 text-sm font-medium text-[#F0D9B5] hover:border-[#A678B9] hover:bg-[#1A1A1F]/80 disabled:opacity-60 transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.8c-.2-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.6 6.4C.6 8.1 0 10 0 12s.6 3.9 1.6 5.6l3.7-2.8z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 19.9 7.4 23 12 23z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#F4A62A] px-6 py-3.5 text-sm font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] disabled:opacity-60 transition-colors shadow-[0_10px_28px_rgba(244,166,42,0.25)]"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {loading
                      ? authTab === 'signin'
                        ? 'Signing in...'
                        : 'Creating account...'
                      : authTab === 'signin'
                        ? 'Login'
                        : 'Create Account'}
                  </span>
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-[#D6C7DF]">
                {authTab === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => switchAuthTab(authTab === 'signin' ? 'signup' : 'signin')}
                  className="font-semibold text-[#F4A62A] hover:underline"
                >
                  {authTab === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>

              {onGoToAdminLogin && (
                <div className="mt-4 pt-4 border-t border-[#6A5ACD]/30 text-center">
                  <button
                    type="button"
                    onClick={onGoToAdminLogin}
                    className="text-xs font-medium text-[#A678B9] hover:text-[#F4A62A] transition-colors"
                  >
                    Administrator access? Sign in via Admin Portal →
                  </button>
                </div>
              )}
            </div>

            <div aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
};
