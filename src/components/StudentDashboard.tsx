import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Camera,
  CheckCircle2,
  Compass,
  Edit3,
  Film,
  Globe,
  GraduationCap,
  Heart,
  Layers,
  Lock,
  Mail,
  MapPin,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { resetPasswordEmail } from '../api/client';
import type {
  AuthSession,
  CareerDefinition,
  EducationStage,
  StudentProfile,
  StudentWorkspaceState,
} from '../types';

interface StudentDashboardProps {
  session: AuthSession;
  workspace: StudentWorkspaceState;
  catalogCareers: CareerDefinition[];
  interviewCompleted: boolean;
  onSaveProfile: (profile: StudentProfile) => void;
  onNavigate: (view: 'interview' | 'explore' | 'roadmap' | 'world' | 'progress') => void;
  onSignOut: () => void;
}

const CLASS_GRADES: EducationStage[] = [
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
  'Vocational & Applied Technology',
];

const SUBJECT_SUGGESTIONS = [
  'Mathematics',
  'Computer Science',
  'Physics',
  'Biology',
  'Chemistry',
  'Economics',
  'Accountancy & Business',
  'Visual Design',
  'Literature & Debate',
  'Environmental Science',
  'Political Science & Law',
  'Statistics',
];

const HOBBY_SUGGESTIONS = [
  'Coding & Robotics',
  'Chess & Strategy',
  'Sketching & Digital Art',
  'Photography & Film',
  'Writing & Debate',
  'Music Production',
  'Gardening & Ecology',
  'Aviation & Aeromodelling',
];

const ACTIVITY_SUGGESTIONS = [
  'Hands-on Prototyping',
  'Analytical Problem Solving',
  'Leading Team Projects',
  'Science Fair Experiments',
  'Visual Storytelling',
  'Mentoring Peers',
  'Public Speaking',
  'Field Research & Audits',
];

const AVATAR_PRESETS = [
  { id: 'atlas-orbit', label: 'Orbit', bg: 'from-[#6A5ACD] to-[#2D2B55]', text: 'A1' },
  { id: 'solar-flare', label: 'Amber', bg: 'from-[#F4A62A] to-[#B45309]', text: 'S2' },
  { id: 'orchid-nebula', label: 'Orchid', bg: 'from-[#A678B9] to-[#2D2B55]', text: 'O3' },
  { id: 'quantum-grid', label: 'Twilight', bg: 'from-[#2D2B55] to-[#1A1A1F]', text: 'Q4' },
];

export const StudentAvatar: React.FC<{
  avatarUrl?: string | null;
  name: string;
  sizeClass?: string;
}> = ({ avatarUrl, name, sizeClass = 'w-16 h-16 text-lg' }) => {
  const initials = (name || 'S')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  if (avatarUrl && avatarUrl.startsWith('data:image/')) {
    return (
      <img
        src={avatarUrl}
        alt={`${name} profile`}
        className={`${sizeClass} rounded-2xl object-cover border border-[#F4A62A]/60 shrink-0`}
      />
    );
  }

  const preset = AVATAR_PRESETS.find((p) => p.id === avatarUrl) || AVATAR_PRESETS[0];
  return (
    <div
      className={`${sizeClass} rounded-2xl bg-gradient-to-br ${preset.bg} border border-[#A678B9]/60 flex items-center justify-center font-display font-bold text-[#F0D9B5] shrink-0 shadow-[0_10px_25px_rgba(10,8,20,0.4)]`}
    >
      {initials || preset.text}
    </div>
  );
};

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  session,
  workspace,
  catalogCareers,
  interviewCompleted,
  onSaveProfile,
  onNavigate,
  onSignOut,
}) => {
  const profile = workspace.profile;
  const [tab, setTab] = useState<'overview' | 'edit' | 'settings'>('overview');

  const [fullName, setFullName] = useState(profile?.fullName || session.fullName || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || session.avatarUrl || 'atlas-orbit');
  const [classGrade, setClassGrade] = useState<EducationStage>(
    (profile?.classGrade as EducationStage) || profile?.educationStage || '12th Standard'
  );
  const [academicStream, setAcademicStream] = useState(profile?.academicStream || STREAMS[0]);
  const [topSubjects, setTopSubjects] = useState<string[]>(
    profile?.topSubjects?.length ? profile.topSubjects : ['Mathematics', 'Computer Science']
  );
  const [customSubject, setCustomSubject] = useState('');
  const [hobbies, setHobbies] = useState<string[]>(
    profile?.hobbies?.length ? profile.hobbies : ['Coding & Robotics', 'Chess & Strategy']
  );
  const [customHobby, setCustomHobby] = useState('');
  const [preferredActivities, setPreferredActivities] = useState<string[]>(
    profile?.preferredActivities?.length
      ? profile.preferredActivities
      : ['Hands-on Prototyping', 'Analytical Problem Solving']
  );
  const [customActivity, setCustomActivity] = useState('');
  const [location, setLocation] = useState(profile?.location || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [curiosities, setCuriosities] = useState(profile?.curiosities || '');
  const [workPreference, setWorkPreference] = useState(
    profile?.workPreference || 'Building interactive systems and solving analytical problems'
  );
  const [longTermGoal, setLongTermGoal] = useState(profile?.longTermGoal || '');

  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCareer =
    catalogCareers.find((c) => c.id === workspace.selectedCareerId) || null;

  const avgSkill = (() => {
    const vals = Object.values(workspace.skills || {});
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 50;
  })();

  const totalMissionsInRoadmap = workspace.roadmap.reduce((sum, st) => sum + st.missions.length, 0);
  const completedCount = workspace.completedMissionIds.length;
  const watchedVideosCount = workspace.watchedVideoSessionIds?.length ?? 0;
  const completed3DCount = workspace.completed3DActivityIds?.length ?? 0;
  const abilityScore =
    workspace.interview.abilityAssessment?.overallScore ??
    workspace.interview.videoInterviewReport?.overallScore ??
    null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        setAvatarUrl(canvas.toDataURL('image/jpeg', 0.82));
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string, limit = 6) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else if (list.length < limit) {
      setList([...list, item]);
    }
  };

  const addCustomTag = (
    value: string,
    clear: () => void,
    list: string[],
    setList: (v: string[]) => void
  ) => {
    const clean = value.trim();
    if (!clean) return;
    if (!list.includes(clean)) {
      setList([...list, clean].slice(0, 8));
    }
    clear();
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: StudentProfile = {
      fullName: fullName.trim() || session.fullName,
      email: session.email,
      avatarUrl,
      classGrade,
      educationStage: classGrade,
      academicStream,
      topSubjects: topSubjects.length ? topSubjects : ['Mathematics'],
      hobbies,
      preferredActivities,
      location: location.trim(),
      bio: bio.trim(),
      curiosities: curiosities.trim() || 'Exploring real-world careers and interactive projects',
      workPreference: workPreference.trim(),
      longTermGoal: longTermGoal.trim() || 'Build a high-impact career pathway',
    };
    onSaveProfile(updated);
    setSaveNotice('Profile updated and saved to your student workspace.');
    setTimeout(() => setSaveNotice(null), 4000);
    setTab('overview');
  };

  const handleSendResetEmail = async () => {
    setSecurityError(null);
    setSecurityNotice(null);
    try {
      await resetPasswordEmail(session.email);
      setSecurityNotice(`Password reset link sent to ${session.email}.`);
    } catch (err) {
      setSecurityError(err instanceof Error ? err.message : 'Unable to send password reset email.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
      {/* Top Student Profile Banner */}
      <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 border-t-[#A678B9]/45 rounded-2xl p-6 sm:p-7 shadow-[0_24px_48px_rgba(10,8,20,0.45)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <StudentAvatar
              avatarUrl={avatarUrl}
              name={fullName || session.fullName}
              sizeClass="w-16 h-16 sm:w-20 sm:h-20 text-xl"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#D6C7DF]">
                <span className="font-mono font-medium text-[#F4A62A]">Homepage · Student Dashboard</span>
                <span aria-hidden="true">·</span>
                <span>{classGrade}</span>
                {location && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#A678B9]" />
                      {location}
                    </span>
                  </>
                )}
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-display font-bold text-[#F0D9B5] truncate">
                {fullName || session.fullName}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[#D6C7DF]">
                {academicStream} · {session.email}
              </p>
            </div>
          </div>

          {/* Segmented Dashboard Sub-Navigation */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/45 p-1">
              <button
                type="button"
                onClick={() => setTab('overview')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  tab === 'overview'
                    ? 'bg-[#F4A62A] text-[#1A1A1F]'
                    : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('edit')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  tab === 'edit'
                    ? 'bg-[#F4A62A] text-[#1A1A1F]'
                    : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('settings')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  tab === 'settings'
                    ? 'bg-[#F4A62A] text-[#1A1A1F]'
                    : 'text-[#D6C7DF] hover:text-[#F0D9B5]'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Account Settings</span>
              </button>
            </div>
          </div>
        </div>

        {saveNotice && (
          <div className="mt-4 rounded-xl border border-emerald-400/50 bg-emerald-950/50 px-4 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
            <span>{saveNotice}</span>
          </div>
        )}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stage 01 VECTORA AI Welcome Hero */}
          <section className="rounded-2xl border border-[#F4A62A]/45 bg-gradient-to-br from-[#2D2B55] via-[#252348] to-[#1A1A1F] p-6 sm:p-7 shadow-[0_24px_48px_rgba(10,8,20,0.45)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-lg border border-[#F4A62A]/45 bg-[#F4A62A]/12 px-3 py-1 text-xs font-mono font-semibold text-[#F4A62A]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    VECTORA AI · {interviewCompleted ? 'Interview Complete' : 'Interview Required Next'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F0D9B5]">
                  Welcome, {fullName || session.fullName}. Let&apos;s map your future after 10th &amp; 12th.
                </h2>
                <p className="text-xs sm:text-sm text-[#D6C7DF] leading-relaxed">
                  VECTORA guides you step by step: start with a friendly AI interview to uncover your strengths and interests, explore personalized career matches, watch animated 12th-to-job journey videos, practice inside our 3D Career World, and track your readiness report.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#A678B9]">
                  <span>1. AI Video Interview</span>
                  <span>→</span>
                  <span>2. Career Assessment</span>
                  <span>→</span>
                  <span>3. Explore Careers</span>
                  <span>→</span>
                  <span>4. Animated Roadmap &amp; 3D World</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                {!interviewCompleted ? (
                  <button
                    type="button"
                    onClick={() => onNavigate('interview')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4A62A] px-6 py-3.5 text-sm font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors shadow-[0_0_24px_rgba(244,166,42,0.28)] whitespace-nowrap"
                  >
                    <span>Start Your AI Career Interview</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onNavigate(selectedCareer ? 'roadmap' : 'explore')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4A62A] px-5 py-3 text-xs sm:text-sm font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors whitespace-nowrap"
                    >
                      <span>{selectedCareer ? 'Continue Career Journey & Videos' : 'Explore Ranked Careers'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('interview')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#6A5ACD]/60 bg-[#1A1A1F] px-5 py-2.5 text-xs font-semibold text-[#F0D9B5] hover:border-[#F4A62A] transition-colors whitespace-nowrap"
                    >
                      <span>Review Interview &amp; Assessment</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
              <div className="text-xs text-[#D6C7DF]">Interview Status</div>
              <div className="mt-1.5 text-lg font-display font-bold text-[#F0D9B5] truncate">
                {interviewCompleted ? 'Completed' : 'Pending'}
              </div>
              <div className="mt-1 text-xs text-[#A678B9] truncate">
                {interviewCompleted ? 'All career stages unlocked' : 'Unlocks Explore, Roadmap & 3D World'}
              </div>
            </div>

            <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
              <div className="text-xs text-[#D6C7DF]">Animated Videos &amp; 3D World</div>
              <div className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-[#F4A62A] flex items-center gap-2">
                <Film className="w-5 h-5" />
                <span>{watchedVideosCount}</span>
                <span className="text-xs font-normal text-[#D6C7DF]">
                  videos · {completed3DCount} 3D
                </span>
              </div>
              <div className="mt-1 text-xs text-[#D6C7DF]">
                {completedCount}/{totalMissionsInRoadmap || 6} roadmap missions done
              </div>
            </div>

            <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
              <div className="text-xs text-[#D6C7DF]">Skill Index Average</div>
              <div className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-[#F0D9B5]">
                {avgSkill}
                <span className="text-sm font-normal text-[#D6C7DF]">/100</span>
              </div>
              <div className="mt-1 text-xs text-[#D6C7DF]">5 tracked competencies</div>
            </div>

            <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
              <div className="text-xs text-[#D6C7DF]">AI Assessment Score</div>
              <div className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-[#F4A62A]">
                {abilityScore !== null ? `${abilityScore}/100` : 'Pending'}
              </div>
              <div className="mt-1 text-xs text-[#D6C7DF]">
                {abilityScore !== null ? 'Verified readiness report' : 'Complete AI interview check'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Academic, Subjects, Interests & Hobbies Details */}
            <div className="lg:col-span-7 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-[#6A5ACD]/35 pb-4">
                <div>
                  <h2 className="text-lg font-display font-bold text-[#F0D9B5]">
                    Student Profile & Academic Context
                  </h2>
                  <p className="text-xs text-[#D6C7DF] mt-0.5">
                    Personalize your subjects, hobbies, and activities to sharpen AI career matches.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('edit')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3 py-1.5 text-xs font-medium text-[#F0D9B5] hover:border-[#F4A62A] hover:text-[#F4A62A] transition-colors whitespace-nowrap shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
              </div>

              {bio && (
                <div>
                  <div className="text-xs font-semibold text-[#A678B9]">Student Bio</div>
                  <p className="mt-1 text-sm text-[#F0D9B5] leading-relaxed">{bio}</p>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F0D9B5]">
                  <BookOpen className="w-3.5 h-3.5 text-[#F4A62A]" />
                  <span>Core Academic Subjects</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {topSubjects.map((s) => (
                    <span
                      key={s}
                      className="rounded-lg border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-1.5 text-xs text-[#F0D9B5]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-[#6A5ACD]/30">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#F0D9B5]">
                    <Heart className="w-3.5 h-3.5 text-[#F4A62A]" />
                    <span>Hobbies & Personal Interests</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {(hobbies.length ? hobbies : ['Not specified yet']).map((h) => (
                      <span
                        key={h}
                        className="rounded-lg border border-[#6A5ACD]/40 bg-[#1A1A1F] px-2.5 py-1 text-xs text-[#D6C7DF]"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#F0D9B5]">
                    <Sparkles className="w-3.5 h-3.5 text-[#A678B9]" />
                    <span>Preferred Activities</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {(preferredActivities.length ? preferredActivities : ['Not specified yet']).map((a) => (
                      <span
                        key={a}
                        className="rounded-lg border border-[#6A5ACD]/40 bg-[#1A1A1F] px-2.5 py-1 text-xs text-[#D6C7DF]"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#6A5ACD]/30 text-xs">
                <div className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/35 p-3.5">
                  <div className="text-[#A678B9] font-medium">Curiosities</div>
                  <div className="mt-1 text-[#F0D9B5] leading-relaxed">
                    {curiosities || 'Add topics that make you curious to refine recommendations.'}
                  </div>
                </div>
                <div className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/35 p-3.5">
                  <div className="text-[#A678B9] font-medium">Long-Term Aspiration</div>
                  <div className="mt-1 text-[#F0D9B5] leading-relaxed">
                    {longTermGoal || 'Set a long-term goal to guide your 5-stage roadmap.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Next Actions & Active Pathway Column */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-display font-bold text-[#F0D9B5]">
                    Active Career Pathway
                  </h2>
                  <Compass className="w-4 h-4 text-[#F4A62A]" />
                </div>

                {selectedCareer ? (
                  <div className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/45 p-4 space-y-3">
                    <div className="text-xs font-mono text-[#F4A62A]">{selectedCareer.domain}</div>
                    <div className="text-base font-display font-bold text-[#F0D9B5]">
                      {selectedCareer.title}
                    </div>
                    <p className="text-xs text-[#D6C7DF] leading-relaxed">
                      {selectedCareer.tagline}
                    </p>
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate('roadmap')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#F4A62A] px-3.5 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors whitespace-nowrap"
                      >
                        <span>Open Roadmap</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('world')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#6A5ACD]/60 bg-[#2D2B55] px-3.5 py-2 text-xs font-semibold text-[#F0D9B5] hover:border-[#F4A62A] transition-colors whitespace-nowrap"
                      >
                        <Globe className="w-3.5 h-3.5 text-[#F4A62A]" />
                        <span>Enter 3D World</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-4 space-y-3">
                    <p className="text-xs text-[#D6C7DF] leading-relaxed">
                      You have not locked a primary career pathway yet. Complete your AI ability check or browse all ranked career categories.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate('interview')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#F4A62A] px-3.5 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors whitespace-nowrap"
                      >
                        <span>{interviewCompleted ? 'Review AI Interview' : 'Start AI Interview'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!interviewCompleted}
                        onClick={() => onNavigate('explore')}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                          interviewCompleted
                            ? 'border-[#6A5ACD]/60 bg-[#2D2B55] text-[#F0D9B5] hover:border-[#F4A62A]'
                            : 'border-[#6A5ACD]/35 bg-[#1A1A1F] text-[#D6C7DF]/55 cursor-not-allowed'
                        }`}
                      >
                        {interviewCompleted ? (
                          <Layers className="w-3.5 h-3.5 text-[#A678B9]" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-[#F4A62A]" />
                        )}
                        <span>{interviewCompleted ? 'Explore Careers' : 'Explore Locked (Interview First)'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Launch Cards */}
              <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-3">
                <h3 className="text-sm font-display font-bold text-[#F0D9B5]">
                  Workspace Shortcuts
                </h3>
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('interview')}
                    className="flex items-center justify-between rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 px-4 py-3 text-left hover:border-[#F4A62A] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GraduationCap className="w-4 h-4 text-[#F4A62A]" />
                      <div>
                        <div className="text-xs font-semibold text-[#F0D9B5]">
                          AI Interview & Ability Questions
                        </div>
                        <div className="text-[11px] text-[#D6C7DF]">
                          Direct questions, live voice call, or Q&A
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#A678B9]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate(interviewCompleted ? 'explore' : 'interview')}
                    className="flex items-center justify-between rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 px-4 py-3 text-left hover:border-[#F4A62A] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {interviewCompleted ? (
                        <Compass className="w-4 h-4 text-[#A678B9]" />
                      ) : (
                        <Lock className="w-4 h-4 text-[#F4A62A]" />
                      )}
                      <div>
                        <div className="text-xs font-semibold text-[#F0D9B5]">
                          {interviewCompleted
                            ? 'Explore 8 Career Categories'
                            : 'Explore Careers (Locked)'}
                        </div>
                        <div className="text-[11px] text-[#D6C7DF]">
                          {interviewCompleted
                            ? 'Compare rankings, eligibility & salaries'
                            : 'Complete the AI interview first to unlock matches'}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#A678B9]" />
                  </button>

                  {selectedCareer && interviewCompleted && (
                    <button
                      type="button"
                      onClick={() => onNavigate('progress')}
                      className="flex items-center justify-between rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 px-4 py-3 text-left hover:border-[#F4A62A] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Award className="w-4 h-4 text-[#F4A62A]" />
                        <div>
                          <div className="text-xs font-semibold text-[#F0D9B5]">
                            Progress Analytics & Pivot Check
                          </div>
                          <div className="text-[11px] text-[#D6C7DF]">
                            Track readiness gaps and skill growth
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#A678B9]" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROFILE TAB */}
      {tab === 'edit' && (
        <form
          onSubmit={handleProfileSave}
          className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 sm:p-8 space-y-7"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#6A5ACD]/35 pb-5">
            <div>
              <h2 className="text-xl font-display font-bold text-[#F0D9B5]">
                Edit Student Profile & Interests
              </h2>
              <p className="text-xs text-[#D6C7DF] mt-1">
                Changes save immediately to your workspace and guide AI career recommendations.
              </p>
            </div>
          </div>

          {/* Profile Picture Selection & Upload */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#F0D9B5]">Profile Picture</label>
            <div className="flex flex-wrap items-center gap-4">
              <StudentAvatar
                avatarUrl={avatarUrl}
                name={fullName || session.fullName}
                sizeClass="w-16 h-16 text-lg"
              />
              <div className="flex flex-wrap items-center gap-2">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setAvatarUrl(preset.id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      avatarUrl === preset.id
                        ? 'border-[#F4A62A] bg-[#F4A62A]/15 text-[#F4A62A]'
                        : 'border-[#6A5ACD]/45 bg-[#1A1A1F] text-[#D6C7DF] hover:text-[#F0D9B5]'
                    }`}
                  >
                    {preset.label} Avatar
                  </button>
                ))}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#A678B9]/60 bg-[#1A1A1F] px-3.5 py-2 text-xs font-semibold text-[#F0D9B5] hover:border-[#F4A62A] hover:text-[#F4A62A] transition-colors whitespace-nowrap"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Basic Info & Class/Grade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/40 focus:border-[#F4A62A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">
                Class / Grade Level
              </label>
              <select
                value={classGrade}
                onChange={(e) => setClassGrade(e.target.value as EducationStage)}
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/40 focus:border-[#F4A62A]"
              >
                {CLASS_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">
                City / School Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bengaluru, India"
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/40 focus:border-[#F4A62A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">
                Academic Stream
              </label>
              <select
                value={academicStream}
                onChange={(e) => setAcademicStream(e.target.value)}
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/40 focus:border-[#F4A62A]"
              >
                {STREAMS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">Short Bio</label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="One line describing your academic background or passion"
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5] placeholder:text-[#A678B9]/65 focus:outline-none focus:ring-2 focus:ring-[#F4A62A]/40 focus:border-[#F4A62A]"
              />
            </div>
          </div>

          {/* Subjects */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#F0D9B5]">
                Academic Subjects (select or add custom)
              </label>
              <span className="text-xs font-mono tabular-nums text-[#F4A62A]">
                {topSubjects.length} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...SUBJECT_SUGGESTIONS, ...topSubjects])).map((subj) => {
                const active = topSubjects.includes(subj);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => toggleItem(topSubjects, setTopSubjects, subj, 8)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#F4A62A] text-[#1A1A1F] border-[#F4A62A] font-semibold'
                        : 'bg-[#1A1A1F] text-[#D6C7DF] border-[#6A5ACD]/45 hover:text-[#F0D9B5]'
                    }`}
                  >
                    {subj}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 max-w-sm pt-1">
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Add another subject"
                className="flex-1 rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] px-3 py-2 text-xs text-[#F0D9B5]"
              />
              <button
                type="button"
                onClick={() =>
                  addCustomTag(customSubject, () => setCustomSubject(''), topSubjects, setTopSubjects)
                }
                className="inline-flex items-center gap-1 rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3 py-2 text-xs font-semibold text-[#F0D9B5] hover:border-[#F4A62A]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Hobbies */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-[#F0D9B5]">Hobbies</label>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...HOBBY_SUGGESTIONS, ...hobbies])).map((hobby) => {
                const active = hobbies.includes(hobby);
                return (
                  <button
                    key={hobby}
                    type="button"
                    onClick={() => toggleItem(hobbies, setHobbies, hobby, 8)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#6A5ACD] text-[#F0D9B5] border-[#A678B9] font-semibold'
                        : 'bg-[#1A1A1F] text-[#D6C7DF] border-[#6A5ACD]/45 hover:text-[#F0D9B5]'
                    }`}
                  >
                    {hobby}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 max-w-sm pt-1">
              <input
                type="text"
                value={customHobby}
                onChange={(e) => setCustomHobby(e.target.value)}
                placeholder="Add custom hobby"
                className="flex-1 rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] px-3 py-2 text-xs text-[#F0D9B5]"
              />
              <button
                type="button"
                onClick={() => addCustomTag(customHobby, () => setCustomHobby(''), hobbies, setHobbies)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3 py-2 text-xs font-semibold text-[#F0D9B5] hover:border-[#F4A62A]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Preferred Activities */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-[#F0D9B5]">
              Preferred Activities
            </label>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...ACTIVITY_SUGGESTIONS, ...preferredActivities])).map((act) => {
                const active = preferredActivities.includes(act);
                return (
                  <button
                    key={act}
                    type="button"
                    onClick={() => toggleItem(preferredActivities, setPreferredActivities, act, 8)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#F4A62A] text-[#1A1A1F] border-[#F4A62A] font-semibold'
                        : 'bg-[#1A1A1F] text-[#D6C7DF] border-[#6A5ACD]/45 hover:text-[#F0D9B5]'
                    }`}
                  >
                    {act}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 max-w-sm pt-1">
              <input
                type="text"
                value={customActivity}
                onChange={(e) => setCustomActivity(e.target.value)}
                placeholder="Add preferred activity"
                className="flex-1 rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] px-3 py-2 text-xs text-[#F0D9B5]"
              />
              <button
                type="button"
                onClick={() =>
                  addCustomTag(
                    customActivity,
                    () => setCustomActivity(''),
                    preferredActivities,
                    setPreferredActivities
                  )
                }
                className="inline-flex items-center gap-1 rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3 py-2 text-xs font-semibold text-[#F0D9B5] hover:border-[#F4A62A]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Interests & Goals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">
                Core Curiosities
              </label>
              <input
                type="text"
                value={curiosities}
                onChange={(e) => setCuriosities(e.target.value)}
                placeholder="Topics you love exploring"
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">
                Working Preference
              </label>
              <input
                type="text"
                value={workPreference}
                onChange={(e) => setWorkPreference(e.target.value)}
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#F0D9B5] mb-1.5">
                Long-Term Career Goal
              </label>
              <input
                type="text"
                value={longTermGoal}
                onChange={(e) => setLongTermGoal(e.target.value)}
                placeholder="e.g. Build healthcare AI tools"
                className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-sm text-[#F0D9B5]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#6A5ACD]/35 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setTab('overview')}
              className="rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-4 py-2.5 text-xs font-semibold text-[#D6C7DF] hover:text-[#F0D9B5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4A62A] px-6 py-2.5 text-sm font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] transition-colors"
            >
              <span>Save Profile Changes</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* ACCOUNT SETTINGS TAB */}
      {tab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="border-b border-[#6A5ACD]/35 pb-4">
              <h2 className="text-lg font-display font-bold text-[#F0D9B5]">
                Account & Security Settings
              </h2>
              <p className="text-xs text-[#D6C7DF] mt-0.5">
                Manage your Vectora student account credentials and workspace synchronization.
              </p>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#F4A62A]" />
                  <div>
                    <div className="text-xs text-[#D6C7DF]">Registered Email</div>
                    <div className="font-medium text-[#F0D9B5]">{session.email}</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-emerald-300">Verified</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-[#A678B9]" />
                  <div>
                    <div className="text-xs text-[#D6C7DF]">Account Status</div>
                    <div className="font-medium text-[#F0D9B5] capitalize">{session.status}</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-[#F4A62A] uppercase">{session.role}</span>
              </div>
            </div>

            <div className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#F0D9B5]">
                <Lock className="w-4 h-4 text-[#F4A62A]" />
                <span>Password & Sign-In Recovery</span>
              </div>
              <p className="text-xs text-[#D6C7DF] leading-relaxed">
                Send a secure password reset email to {session.email} if you sign in using Email & Password.
              </p>
              <button
                type="button"
                onClick={handleSendResetEmail}
                className="rounded-xl border border-[#F4A62A]/60 bg-[#2D2B55] px-4 py-2 text-xs font-semibold text-[#F4A62A] hover:bg-[#F4A62A] hover:text-[#1A1A1F] transition-colors"
              >
                Send Password Reset Email
              </button>

              {securityNotice && (
                <div className="rounded-xl border border-emerald-400/50 bg-emerald-950/50 px-3.5 py-2 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{securityNotice}</span>
                </div>
              )}
              {securityError && (
                <div className="rounded-xl border border-red-400/50 bg-red-950/60 px-3.5 py-2 text-xs text-red-200 flex items-center gap-2">
                  <X className="w-4 h-4 shrink-0" />
                  <span>{securityError}</span>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <h3 className="text-base font-display font-bold text-[#F0D9B5]">Session Controls</h3>
              <p className="text-xs text-[#D6C7DF] leading-relaxed">
                Your profile, ability evaluations, career comparisons, 3D campus unlocks, and mission submissions remain saved when you sign out.
              </p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full rounded-xl border border-red-400/50 bg-red-950/40 px-4 py-3 text-xs font-semibold text-red-200 hover:bg-red-900/50 transition-colors"
            >
              Sign Out of Student Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
