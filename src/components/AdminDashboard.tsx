import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Box,
  Briefcase,
  CheckCircle2,
  Compass,
  ExternalLink,
  Flag,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  Users,
} from 'lucide-react';
import {
  createAdminIssue,
  createAdminInvitation,
  fetchAdminAiConfig,
  fetchAdminCareers,
  fetchAdminEnvironments,
  fetchAdminInvitations,
  fetchAdminMissions,
  fetchAdminOverview,
  fetchAdminRoadmaps,
  fetchAdminSecurityStatus,
  fetchAdminStudents,
  removeAdminCareer,
  removeAdminEnvironment,
  removeAdminMission,
  removeAdminRoadmap,
  revokeAdminInvitation,
  saveAdminCareer,
  saveAdminEnvironment,
  saveAdminInterviewConfig,
  saveAdminMission,
  saveAdminRecommendationConfig,
  saveAdminRoadmap,
  updateAdminAccount,
  updateAdminIssueStatus,
  updateAdminStudent,
} from '../api/client';
import { CAREER_CATEGORIES } from '../data/careers';
import { StudentAvatar } from './StudentDashboard';
import type {
  AccountStatus,
  AdminInterviewSettings,
  AdminInvitationRecord,
  AdminOverviewResponse,
  AdminPermission,
  AdminRecommendationSettings,
  AdminStudentRecord,
  AuthSession,
  ManagedCareerRecord,
  ManagedEnvironmentRecord,
  ManagedMissionRecord,
  ManagedRoadmapRecord,
  StageType,
  UserRole,
} from '../types';

export type AdminSection =
  | 'overview'
  | 'students'
  | 'careers'
  | 'ai-interview'
  | 'ai-recommendations'
  | 'missions'
  | 'worlds'
  | 'roadmaps'
  | 'reports';

interface AdminDashboardProps {
  session: AuthSession;
  activeSection?: AdminSection;
  onSectionChange?: (section: AdminSection) => void;
  onSessionPromoted: (updated: AuthSession) => void;
  onCatalogChanged: () => void;
}

const ALL_PERMISSIONS: { id: AdminPermission; label: string }[] = [
  { id: 'manage_students', label: 'Manage Students' },
  { id: 'manage_careers', label: 'Manage Careers' },
  { id: 'manage_ai', label: 'Manage AI Systems' },
  { id: 'manage_worlds', label: 'Manage 3D Worlds' },
  { id: 'manage_missions', label: 'Manage Missions' },
  { id: 'manage_roadmaps', label: 'Manage Roadmaps' },
  { id: 'view_analytics', label: 'View Analytics' },
  { id: 'manage_security', label: 'Security & RBAC' },
];

const NAV_SECTIONS: {
  id: AdminSection;
  label: string;
  permission?: AdminPermission;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'overview', label: 'Overview & Analytics', permission: 'view_analytics', icon: BarChart3 },
  { id: 'students', label: 'Student Accounts', permission: 'manage_students', icon: Users },
  { id: 'careers', label: 'Career Management', permission: 'manage_careers', icon: Briefcase },
  { id: 'ai-interview', label: 'AI Interview Questions', permission: 'manage_ai', icon: Bot },
  { id: 'ai-recommendations', label: 'Recommendation Criteria', permission: 'manage_ai', icon: Sliders },
  { id: 'missions', label: 'Career Missions', permission: 'manage_missions', icon: Award },
  { id: 'worlds', label: '3D Career Worlds', permission: 'manage_worlds', icon: Box },
  { id: 'roadmaps', label: 'Roadmaps & Education', permission: 'manage_roadmaps', icon: BookOpen },
  { id: 'reports', label: 'Reports & Settings', icon: ShieldCheck },
];

function sanitizeExternalUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // ignore invalid URL
  }
  return 'https://www.education.gov.in';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  session,
  activeSection,
  onSectionChange,
  onSessionPromoted,
  onCatalogChanged,
}) => {
  const [internalSection, setInternalSection] = useState<AdminSection>(activeSection || 'overview');
  const section = activeSection || internalSection;
  const setSection = (next: AdminSection) => {
    setInternalSection(next);
    onSectionChange?.(next);
  };

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Admin Invitation & Security State
  const [securityStatus, setSecurityStatus] = useState<{
    hasEnvCode: boolean;
    isClaimed: boolean;
    requiresSetupClaim: boolean;
  } | null>(null);
  const [invitations, setInvitations] = useState<AdminInvitationRecord[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');

  // Data States
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [students, setStudents] = useState<AdminStudentRecord[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<'all' | AccountStatus>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  const [careers, setCareers] = useState<ManagedCareerRecord[]>([]);
  const [careerCategoryFilter, setCareerCategoryFilter] = useState<string>('All');
  const [editingCareer, setEditingCareer] = useState<ManagedCareerRecord | null>(null);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([...CAREER_CATEGORIES]);

  const [interviewSettings, setInterviewSettings] = useState<AdminInterviewSettings | null>(null);
  const [recSettings, setRecSettings] = useState<AdminRecommendationSettings | null>(null);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newQuestionPrompt, setNewQuestionPrompt] = useState('');
  const [newQuestionCategory, setNewQuestionCategory] = useState('Analytical & Quantitative Reasoning');
  const [newQuestionDifficulty, setNewQuestionDifficulty] = useState('Intermediate');
  const [newQuestionRubric, setNewQuestionRubric] = useState('');

  const [flagCareerId, setFlagCareerId] = useState('');
  const [flagReason, setFlagReason] = useState('');

  const [environments, setEnvironments] = useState<ManagedEnvironmentRecord[]>([]);
  const [editingEnv, setEditingEnv] = useState<ManagedEnvironmentRecord | null>(null);

  const [missions, setMissions] = useState<ManagedMissionRecord[]>([]);
  const [editingMission, setEditingMission] = useState<ManagedMissionRecord | null>(null);

  const [roadmaps, setRoadmaps] = useState<ManagedRoadmapRecord[]>([]);
  const [editingRoadmap, setEditingRoadmap] = useState<ManagedRoadmapRecord | null>(null);

  // Analytics Issue Form
  const [newIssueArea, setNewIssueArea] = useState('Career Catalog');
  const [newIssueSeverity, setNewIssueSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [newIssueMsg, setNewIssueMsg] = useState('');

  // Admin Account Security Form
  const [adminDisplayName, setAdminDisplayName] = useState(session.fullName);
  const [newAdminPasscode, setNewAdminPasscode] = useState('');

  const notify = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const hasPermission = useCallback(
    (perm?: AdminPermission) => {
      if (session.role !== 'admin') return false;
      if (!perm) return true;
      return session.permissions.includes(perm) || session.permissions.includes('manage_security');
    },
    [session.role, session.permissions]
  );

  const loadSectionData = useCallback(
    async (target: AdminSection) => {
      if (session.role !== 'admin') return;
      setLoading(true);
      try {
        if ((target === 'overview' || target === 'reports') && hasPermission('view_analytics')) {
          const data = await fetchAdminOverview();
          setOverview(data);
        }
        if (target === 'students' && hasPermission('manage_students')) {
          const res = await fetchAdminStudents();
          setStudents(res.students);
          if (res.students.length > 0 && selectedStudentId === null) {
            setSelectedStudentId(res.students[0].id);
          }
        }
        if (target === 'careers' && hasPermission('manage_careers')) {
          const res = await fetchAdminCareers();
          setCareers(res.careers);
          const mergedCats = Array.from(
            new Set([...CAREER_CATEGORIES, ...res.careers.map((c) => c.domain)])
          );
          setCustomCategories(mergedCats);
        }
        if (
          (target === 'ai-interview' || target === 'ai-recommendations') &&
          hasPermission('manage_ai')
        ) {
          const res = await fetchAdminAiConfig();
          setInterviewSettings(res.interviewSettings);
          setRecSettings(res.recommendationSettings);
          if (careers.length === 0) {
            fetchAdminCareers()
              .then((c) => setCareers(c.careers))
              .catch(() => undefined);
          }
        }
        if (target === 'worlds' && hasPermission('manage_worlds')) {
          const res = await fetchAdminEnvironments();
          setEnvironments(res.environments);
        }
        if (target === 'missions' && hasPermission('manage_missions')) {
          const [mRes, cRes, eRes] = await Promise.all([
            fetchAdminMissions(),
            fetchAdminCareers().catch(() => ({ careers: [] })),
            fetchAdminEnvironments().catch(() => ({ environments: [] })),
          ]);
          setMissions(mRes.missions);
          if (cRes.careers.length) setCareers(cRes.careers);
          if (eRes.environments.length) setEnvironments(eRes.environments);
        }
        if (target === 'roadmaps' && hasPermission('manage_roadmaps')) {
          const [rRes, cRes] = await Promise.all([
            fetchAdminRoadmaps(),
            fetchAdminCareers().catch(() => ({ careers: [] })),
          ]);
          setRoadmaps(rRes.roadmaps);
          if (cRes.careers.length) setCareers(cRes.careers);
        }
        if (target === 'reports') {
          const [st, invRes] = await Promise.all([
            fetchAdminSecurityStatus(),
            hasPermission('manage_security')
              ? fetchAdminInvitations().catch(() => ({ invitations: [] }))
              : Promise.resolve({ invitations: [] }),
          ]);
          setSecurityStatus(st);
          setInvitations(invRes.invitations);
        }
      } catch (err) {
        notify('err', err instanceof Error ? err.message : 'Failed to load admin module.');
      } finally {
        setLoading(false);
      }
    },
    [session.role, hasPermission, selectedStudentId, careers.length]
  );

  useEffect(() => {
    if (session.role !== 'admin') return;
    loadSectionData(section);
  }, [session.role, section, loadSectionData]);

  // Hard guard: unprivileged sessions cannot render AdminDashboard
  if (session.role !== 'admin') {
    return null;
  }

  // Filtered students list
  const filteredStudents = students.filter((st) => {
    const matchesSearch =
      !studentSearch.trim() ||
      st.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      st.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (st.profile?.classGrade || st.profile?.educationStage || '')
        .toLowerCase()
        .includes(studentSearch.toLowerCase());
    const matchesStatus = studentFilter === 'all' || st.status === studentFilter;
    return matchesSearch && matchesStatus;
  });

  const activeStudentDetail =
    students.find((s) => s.id === selectedStudentId) || filteredStudents[0] || null;

  const filteredCareers =
    careerCategoryFilter === 'All'
      ? careers
      : careers.filter((c) => c.domain === careerCategoryFilter);

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-6">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sidebar Navigation (260px on desktop) */}
        <aside className="w-full lg:w-[260px] shrink-0 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-4 space-y-4">
          <div className="border-b border-[#6A5ACD]/35 pb-3.5 px-2">
            <div className="text-xs font-mono font-medium text-[#F4A62A]">Admin Console</div>
            <div className="mt-1 text-sm font-display font-bold text-[#F0D9B5] truncate">
              {session.fullName}
            </div>
            <div className="text-[11px] text-[#D6C7DF] truncate">{session.email}</div>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            {NAV_SECTIONS.map((item) => {
              const Icon = item.icon;
              const allowed = hasPermission(item.permission);
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!allowed}
                  onClick={() => setSection(item.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 text-left ${
                    active
                      ? 'bg-[#F4A62A] text-[#1A1A1F] font-semibold'
                      : allowed
                        ? 'text-[#D6C7DF] hover:bg-[#1A1A1F]/70 hover:text-[#F0D9B5]'
                        : 'text-[#6A5ACD]/45 cursor-not-allowed'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-[#6A5ACD]/35 px-2 text-[11px] text-[#A678B9]">
            RBAC Role: <span className="font-mono text-[#F4A62A]">ADMIN</span>
          </div>
        </aside>

        {/* Main Admin Workspace */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {/* Top Breadcrumb Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl px-6 py-4">
            <div className="flex items-center gap-2 text-xs text-[#D6C7DF]">
              <span className="font-mono text-[#F4A62A]">Admin</span>
              <span aria-hidden="true">/</span>
              <span className="text-sm font-display font-bold text-[#F0D9B5]">
                {NAV_SECTIONS.find((n) => n.id === section)?.label}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {toast && (
                <div
                  className={`rounded-lg border px-3 py-1.5 text-xs flex items-center gap-1.5 ${
                    toast.type === 'ok'
                      ? 'border-emerald-400/50 bg-emerald-950/60 text-emerald-200'
                      : 'border-red-400/50 bg-red-950/60 text-red-200'
                  }`}
                >
                  {toast.type === 'ok' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )}
                  <span>{toast.text}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => loadSectionData(section)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3.5 py-2 text-xs font-semibold text-[#F0D9B5] hover:border-[#F4A62A] disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* B. DASHBOARD OVERVIEW */}
          {section === 'overview' && overview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
                  <div className="text-xs text-[#D6C7DF]">Total Registered Students</div>
                  <div className="mt-1.5 text-3xl font-mono font-bold tabular-nums text-[#F0D9B5]">
                    {overview.kpis.totalStudents}
                  </div>
                  <div className="mt-1 text-xs text-emerald-300">
                    {overview.kpis.activeStudents} active · {overview.kpis.suspendedStudents} suspended
                  </div>
                </div>
                <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
                  <div className="text-xs text-[#D6C7DF]">Active Careers Available</div>
                  <div className="mt-1.5 text-3xl font-mono font-bold tabular-nums text-[#F4A62A]">
                    {overview.kpis.totalCareers}
                  </div>
                  <div className="mt-1 text-xs text-[#D6C7DF]">Across 8 career categories</div>
                </div>
                <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
                  <div className="text-xs text-[#D6C7DF]">Total Career Missions</div>
                  <div className="mt-1.5 text-3xl font-mono font-bold tabular-nums text-[#F0D9B5]">
                    {overview.kpis.totalMissions}
                  </div>
                  <div className="mt-1 text-xs text-[#D6C7DF]">
                    {overview.kpis.totalCompletedMissions} student completions
                  </div>
                </div>
                <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
                  <div className="text-xs text-[#D6C7DF]">Completion Rate & Alerts</div>
                  <div className="mt-1.5 text-3xl font-mono font-bold tabular-nums text-[#F4A62A]">
                    {overview.kpis.avgCompletionRate}%
                  </div>
                  <div className="mt-1 text-xs text-[#D6C7DF]">
                    {overview.kpis.openIssuesCount} items requiring review
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Most Explored Categories */}
                <div className="lg:col-span-5 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4">
                  <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                    Most Explored Career Categories
                  </h2>
                  <div className="space-y-3">
                    {overview.mostExploredCategories.map((item) => {
                      const maxCount = Math.max(
                        1,
                        ...overview.mostExploredCategories.map((c) => c.count)
                      );
                      const pct = Math.round((item.count / maxCount) * 100);
                      return (
                        <div key={item.category} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#F0D9B5] truncate pr-2">{item.category}</span>
                            <span className="font-mono tabular-nums text-[#F4A62A]">
                              {item.count}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[#1A1A1F] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#F4A62A]"
                              style={{ width: `${Math.max(4, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Overall Platform Activity Table */}
                <div className="lg:col-span-7 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4">
                  <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                    Overall Platform Activity
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#6A5ACD]/35 text-[#A678B9]">
                          <th className="py-2.5 pr-3 font-semibold">Student</th>
                          <th className="py-2.5 px-3 font-semibold">Active Career</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Missions</th>
                          <th className="py-2.5 pl-3 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#6A5ACD]/20">
                        {overview.recentActivity.map((act) => (
                          <tr key={act.uid} className="hover:bg-[#1A1A1F]/40">
                            <td className="py-3 pr-3">
                              <div className="font-semibold text-[#F0D9B5]">{act.fullName}</div>
                              <div className="text-[11px] text-[#D6C7DF]">{act.email}</div>
                            </td>
                            <td className="py-3 px-3 text-[#D6C7DF]">{act.careerTitle}</td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-[#F4A62A]">
                              {act.completedCount}
                            </td>
                            <td className="py-3 pl-3 text-right">
                              <span
                                className={`font-mono text-[11px] uppercase ${
                                  act.status === 'active'
                                    ? 'text-emerald-300'
                                    : act.status === 'suspended'
                                      ? 'text-red-300'
                                      : 'text-[#F4A62A]'
                                }`}
                              >
                                {act.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* C. STUDENT MANAGEMENT */}
          {section === 'students' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-7 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#A678B9] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search by student name, email, or class..."
                      className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] pl-10 pr-4 py-2 text-xs text-[#F0D9B5]"
                    />
                  </div>
                  <div className="inline-flex rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/45 p-1 shrink-0">
                    {(['all', 'active', 'flagged', 'suspended'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStudentFilter(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
                          studentFilter === st
                            ? 'bg-[#F4A62A] text-[#1A1A1F] font-semibold'
                            : 'text-[#D6C7DF]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#6A5ACD]/35 text-[#A678B9]">
                        <th className="py-2.5 pr-3 font-semibold">Student</th>
                        <th className="py-2.5 px-3 font-semibold">Class & Stream</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Missions</th>
                        <th className="py-2.5 pl-3 font-semibold text-right">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#6A5ACD]/20">
                      {filteredStudents.map((st) => (
                        <tr
                          key={st.id}
                          onClick={() => setSelectedStudentId(st.id)}
                          className={`cursor-pointer transition-colors ${
                            activeStudentDetail?.id === st.id
                              ? 'bg-[#1A1A1F]/80'
                              : 'hover:bg-[#1A1A1F]/40'
                          }`}
                        >
                          <td className="py-3 pr-3 flex items-center gap-2.5">
                            <StudentAvatar
                              avatarUrl={st.avatarUrl}
                              name={st.fullName}
                              sizeClass="w-8 h-8 text-xs"
                            />
                            <div>
                              <div className="font-semibold text-[#F0D9B5]">{st.fullName}</div>
                              <div className="text-[11px] text-[#D6C7DF]">{st.email}</div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[#D6C7DF]">
                            <div>{st.profile?.classGrade || st.profile?.educationStage || 'Not set'}</div>
                            <div className="text-[11px] text-[#A678B9] truncate max-w-[160px]">
                              {st.profile?.academicStream || 'General'}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-[#F4A62A]">
                            {st.completedMissionsCount}
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <span
                              className={`font-mono text-[11px] uppercase ${
                                st.status === 'active'
                                  ? 'text-emerald-300'
                                  : st.status === 'suspended'
                                    ? 'text-red-300'
                                    : 'text-[#F4A62A]'
                              }`}
                            >
                              {st.role} · {st.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Student Inspector & RBAC Control */}
              <div className="xl:col-span-5 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-5">
                {activeStudentDetail ? (
                  <>
                    <div className="flex items-center gap-3.5 border-b border-[#6A5ACD]/35 pb-4">
                      <StudentAvatar
                        avatarUrl={activeStudentDetail.avatarUrl}
                        name={activeStudentDetail.fullName}
                        sizeClass="w-12 h-12 text-sm"
                      />
                      <div className="min-w-0">
                        <h3 className="text-base font-display font-bold text-[#F0D9B5] truncate">
                          {activeStudentDetail.fullName}
                        </h3>
                        <div className="text-xs text-[#D6C7DF] truncate">
                          {activeStudentDetail.email}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/35 p-3">
                        <div className="text-[#A678B9]">Class / Grade</div>
                        <div className="mt-0.5 font-semibold text-[#F0D9B5]">
                          {activeStudentDetail.profile?.classGrade ||
                            activeStudentDetail.profile?.educationStage ||
                            'Unconfigured'}
                        </div>
                      </div>
                      <div className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/35 p-3">
                        <div className="text-[#A678B9]">Subjects</div>
                        <div className="mt-0.5 font-semibold text-[#F0D9B5] truncate">
                          {activeStudentDetail.profile?.topSubjects?.join(', ') || 'None yet'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="font-semibold text-[#F0D9B5]">
                        Account Status & Issue Handling
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(['active', 'flagged', 'suspended'] as const).map((statusVal) => (
                          <button
                            key={statusVal}
                            type="button"
                            onClick={async () => {
                              try {
                                await updateAdminStudent(activeStudentDetail.id, {
                                  status: statusVal,
                                });
                                notify('ok', `Updated account status to ${statusVal}.`);
                                loadSectionData('students');
                              } catch (err) {
                                notify(
                                  'err',
                                  err instanceof Error ? err.message : 'Status update failed.'
                                );
                              }
                            }}
                            className={`rounded-lg border px-3 py-1.5 font-semibold capitalize ${
                              activeStudentDetail.status === statusVal
                                ? 'bg-[#F4A62A] text-[#1A1A1F] border-[#F4A62A]'
                                : 'bg-[#1A1A1F] text-[#D6C7DF] border-[#6A5ACD]/45 hover:border-[#F4A62A]'
                            }`}
                          >
                            {statusVal}
                          </button>
                        ))}
                      </div>
                    </div>

                    {hasPermission('manage_security') && (
                      <div className="space-y-3 pt-3 border-t border-[#6A5ACD]/35 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#F0D9B5]">
                            Role & Access Permissions
                          </span>
                          <div className="inline-flex rounded-lg bg-[#1A1A1F] border border-[#6A5ACD]/45 p-0.5">
                            {(['student', 'admin'] as UserRole[]).map((roleVal) => (
                              <button
                                key={roleVal}
                                type="button"
                                onClick={async () => {
                                  try {
                                    await updateAdminStudent(activeStudentDetail.id, {
                                      role: roleVal,
                                      permissions:
                                        roleVal === 'admin'
                                          ? ALL_PERMISSIONS.map((p) => p.id)
                                          : [],
                                    });
                                    notify('ok', `Account role set to ${roleVal}.`);
                                    loadSectionData('students');
                                  } catch (err) {
                                    notify(
                                      'err',
                                      err instanceof Error ? err.message : 'Role update failed.'
                                    );
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-md capitalize font-semibold ${
                                  activeStudentDetail.role === roleVal
                                    ? 'bg-[#6A5ACD] text-[#F0D9B5]'
                                    : 'text-[#D6C7DF]'
                                }`}
                              >
                                {roleVal}
                              </button>
                            ))}
                          </div>
                        </div>

                        {activeStudentDetail.role === 'admin' && (
                          <div className="grid grid-cols-2 gap-2">
                            {ALL_PERMISSIONS.map((perm) => {
                              const enabled = activeStudentDetail.permissions.includes(perm.id);
                              return (
                                <button
                                  key={perm.id}
                                  type="button"
                                  onClick={async () => {
                                    const next = enabled
                                      ? activeStudentDetail.permissions.filter((p) => p !== perm.id)
                                      : [...activeStudentDetail.permissions, perm.id];
                                    await updateAdminStudent(activeStudentDetail.id, {
                                      permissions: next,
                                    });
                                    loadSectionData('students');
                                  }}
                                  className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium ${
                                    enabled
                                      ? 'border-[#F4A62A] bg-[#F4A62A]/15 text-[#F4A62A]'
                                      : 'border-[#6A5ACD]/40 bg-[#1A1A1F] text-[#D6C7DF]'
                                  }`}
                                >
                                  {perm.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-[#D6C7DF]">Select a student to inspect details.</div>
                )}
              </div>
            </div>
          )}

          {/* D. CAREER MANAGEMENT */}
          {section === 'careers' && (
            <div className="space-y-6">
              <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                      Career Categories & Catalog
                    </h2>
                    <p className="text-xs text-[#D6C7DF]">
                      Add, edit, or remove careers across the 8 primary domains and custom categories.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingCareer({
                        id: `career-${Date.now()}`,
                        title: '',
                        domain: customCategories[0],
                        tagline: '',
                        description: '',
                        accentColor: '#F4A62A',
                        eligibility12th: '',
                        entranceExams: ['National Entrance Exam'],
                        recommendedCourses: ['Undergraduate Specialization'],
                        counsellingNotes: '',
                        requiredSkills: {
                          'Analytical Reasoning': 80,
                          'Systems Architecture': 75,
                          'Applied Mathematics': 70,
                          'Communication': 80,
                          'Execution & Delivery': 80,
                        },
                        salaryBand: '$75k – $150k / ₹10L – ₹30L',
                        growthOutlook: '+22% projected 10-year demand',
                        workplaceRoles: ['Lead Specialist'],
                        specializations: ['Applied Track'],
                        dailySimulationContext: 'Cross-functional project problem solving.',
                        scholarships: [],
                        externalLinks: [],
                        isActive: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Career</span>
                  </button>
                </div>

                {/* Category Filter Bar + Custom Category Creator */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCareerCategoryFilter('All')}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      careerCategoryFilter === 'All'
                        ? 'bg-[#F4A62A] text-[#1A1A1F] border-[#F4A62A] font-semibold'
                        : 'bg-[#1A1A1F] text-[#D6C7DF] border-[#6A5ACD]/45'
                    }`}
                  >
                    All ({careers.length})
                  </button>
                  {customCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCareerCategoryFilter(cat)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        careerCategoryFilter === cat
                          ? 'bg-[#F4A62A] text-[#1A1A1F] border-[#F4A62A] font-semibold'
                          : 'bg-[#1A1A1F] text-[#D6C7DF] border-[#6A5ACD]/45 hover:text-[#F0D9B5]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <input
                      type="text"
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      placeholder="New category..."
                      className="rounded-lg border border-[#6A5ACD]/45 bg-[#1A1A1F] px-2.5 py-1.5 text-xs text-[#F0D9B5] w-36"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customCategoryName.trim()) {
                          setCustomCategories((prev) =>
                            Array.from(new Set([...prev, customCategoryName.trim()]))
                          );
                          setCustomCategoryName('');
                        }
                      }}
                      className="rounded-lg border border-[#6A5ACD]/55 bg-[#1A1A1F] px-2.5 py-1.5 text-xs text-[#F0D9B5] hover:border-[#F4A62A]"
                    >
                      + Category
                    </button>
                  </div>
                </div>

                {/* Careers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCareers.map((career) => (
                    <div
                      key={career.id}
                      className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono text-[#F4A62A]">{career.domain}</span>
                          <span className={career.isActive ? 'text-emerald-300' : 'text-[#A678B9]'}>
                            {career.isActive ? 'Active' : 'Hidden'}
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-display font-bold text-[#F0D9B5]">
                          {career.title}
                        </div>
                        <p className="mt-1 text-xs text-[#D6C7DF] line-clamp-2">{career.tagline}</p>
                        <div className="mt-2 text-[11px] text-[#A678B9]">
                          Exams: {career.entranceExams.slice(0, 2).join(', ')} · {career.salaryBand}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#6A5ACD]/25">
                        <button
                          type="button"
                          onClick={() => setEditingCareer(career)}
                          className="rounded-lg border border-[#6A5ACD]/55 bg-[#2D2B55] px-3 py-1.5 text-xs font-semibold text-[#F0D9B5] hover:border-[#F4A62A]"
                        >
                          Edit Details
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await removeAdminCareer(career.id);
                            notify('ok', `Removed career "${career.title}".`);
                            onCatalogChanged();
                            loadSectionData('careers');
                          }}
                          className="rounded-lg border border-red-400/40 bg-red-950/40 p-1.5 text-red-300 hover:bg-red-900/50"
                          aria-label={`Delete ${career.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Career Editor Form */}
              {editingCareer && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await saveAdminCareer(editingCareer);
                      notify('ok', `Saved "${editingCareer.title}" to Cloud SQL.`);
                      setEditingCareer(null);
                      onCatalogChanged();
                      loadSectionData('careers');
                    } catch (err) {
                      notify('err', err instanceof Error ? err.message : 'Failed to save career.');
                    }
                  }}
                  className="bg-[#2D2B55] border border-[#F4A62A]/60 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[#6A5ACD]/35 pb-3">
                    <h3 className="text-base font-display font-bold text-[#F0D9B5]">
                      {careers.some((c) => c.id === editingCareer.id)
                        ? `Edit Career: ${editingCareer.title}`
                        : 'Create New Career Track'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingCareer(null)}
                      className="text-xs text-[#D6C7DF] hover:text-[#F0D9B5]"
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-[#F0D9B5] mb-1">Career Title</label>
                      <input
                        type="text"
                        required
                        value={editingCareer.title}
                        onChange={(e) =>
                          setEditingCareer({ ...editingCareer, title: e.target.value })
                        }
                        className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#F0D9B5] mb-1">Category</label>
                      <select
                        value={editingCareer.domain}
                        onChange={(e) =>
                          setEditingCareer({ ...editingCareer, domain: e.target.value })
                        }
                        className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                      >
                        {customCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-[#F0D9B5] mb-1">
                        Growth & Salary Outlook
                      </label>
                      <input
                        type="text"
                        value={editingCareer.salaryBand}
                        onChange={(e) =>
                          setEditingCareer({ ...editingCareer, salaryBand: e.target.value })
                        }
                        className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-[#F0D9B5] mb-1">Tagline</label>
                      <input
                        type="text"
                        required
                        value={editingCareer.tagline}
                        onChange={(e) =>
                          setEditingCareer({ ...editingCareer, tagline: e.target.value })
                        }
                        className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#F0D9B5] mb-1">
                        Qualifications / Eligibility
                      </label>
                      <input
                        type="text"
                        required
                        value={editingCareer.eligibility12th}
                        onChange={(e) =>
                          setEditingCareer({ ...editingCareer, eligibility12th: e.target.value })
                        }
                        className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-[#F0D9B5] mb-1">
                        Recommended Courses (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={editingCareer.recommendedCourses.join(', ')}
                        onChange={(e) =>
                          setEditingCareer({
                            ...editingCareer,
                            recommendedCourses: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#F0D9B5] mb-1">
                        Workplace Opportunities & Roles (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={editingCareer.workplaceRoles.join(', ')}
                        onChange={(e) =>
                          setEditingCareer({
                            ...editingCareer,
                            workplaceRoles: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                      />
                    </div>
                  </div>

                  {/* Skill Requirements */}
                  <div className="space-y-2 text-xs">
                    <label className="block font-semibold text-[#F0D9B5]">
                      Required Skill Thresholds (0–100)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {Object.entries(editingCareer.requiredSkills).map(([sk, val]) => (
                        <div key={sk} className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-2.5">
                          <div className="text-[11px] text-[#D6C7DF] truncate">{sk}</div>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={val}
                            onChange={(e) =>
                              setEditingCareer({
                                ...editingCareer,
                                requiredSkills: {
                                  ...editingCareer.requiredSkills,
                                  [sk]: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                                },
                              })
                            }
                            className="mt-1 w-full bg-transparent font-mono font-bold text-[#F4A62A] focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="inline-flex items-center gap-2 text-xs text-[#F0D9B5]">
                      <input
                        type="checkbox"
                        checked={editingCareer.isActive}
                        onChange={(e) =>
                          setEditingCareer({ ...editingCareer, isActive: e.target.checked })
                        }
                      />
                      <span>Visible in Student Career Explorer & Recommendations</span>
                    </label>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#F4A62A] px-5 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C]"
                    >
                      Save Career Track
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* E. AI INTERVIEW MANAGEMENT */}
          {section === 'ai-interview' && interviewSettings && (
            <div className="space-y-6">
              <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#6A5ACD]/35 pb-4">
                  <div>
                    <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                      AI Interview Instructions, Criteria & Categories
                    </h2>
                    <p className="text-xs text-[#D6C7DF]">
                      Configure AI interviewer rubric, probing rules, and interview quality standards.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await saveAdminInterviewConfig(interviewSettings);
                      notify('ok', 'AI interview instructions and questions saved.');
                    }}
                    className="rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C]"
                  >
                    Save AI Interview Config
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
                  <div>
                    <label className="block font-semibold text-[#F0D9B5] mb-1.5">
                      System Instructions
                    </label>
                    <textarea
                      rows={4}
                      value={interviewSettings.systemInstructions}
                      onChange={(e) =>
                        setInterviewSettings({
                          ...interviewSettings,
                          systemInstructions: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] p-3 text-[#F0D9B5]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#F0D9B5] mb-1.5">
                      Interview Quality Audit Notes
                    </label>
                    <textarea
                      rows={4}
                      value={interviewSettings.qualityNotes}
                      onChange={(e) =>
                        setInterviewSettings({
                          ...interviewSettings,
                          qualityNotes: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] p-3 text-[#F0D9B5]"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="block font-semibold text-[#F0D9B5]">
                    Interview Categories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {interviewSettings.categories.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#6A5ACD]/45 bg-[#1A1A1F] px-3 py-1.5 text-[#F0D9B5]"
                      >
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setInterviewSettings({
                              ...interviewSettings,
                              categories: interviewSettings.categories.filter((c) => c !== cat),
                            })
                          }
                          className="text-[#A678B9] hover:text-red-300"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        placeholder="New interview category"
                        className="rounded-lg border border-[#6A5ACD]/45 bg-[#1A1A1F] px-3 py-1 text-[#F0D9B5]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCategoryInput.trim()) return;
                          setInterviewSettings({
                            ...interviewSettings,
                            categories: Array.from(
                              new Set([...interviewSettings.categories, newCategoryInput.trim()])
                            ),
                          });
                          setNewCategoryInput('');
                        }}
                        className="rounded-lg border border-[#6A5ACD]/55 bg-[#1A1A1F] px-3 py-1 text-[#F4A62A] font-semibold"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="block font-semibold text-[#F0D9B5]">
                    Assessment Criteria (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={interviewSettings.assessmentCriteria.join('\n')}
                    onChange={(e) =>
                      setInterviewSettings({
                        ...interviewSettings,
                        assessmentCriteria: e.target.value
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] p-3 text-[#F0D9B5]"
                  />
                </div>
              </div>

              {/* Interview Question Bank */}
              <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-display font-bold text-[#F0D9B5]">
                  Managed Interview Questions Bank
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {interviewSettings.questions.map((q) => (
                    <div
                      key={q.id}
                      className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-4 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#F4A62A]">{q.category}</span>
                        <span className="text-[#A678B9]">{q.difficulty}</span>
                      </div>
                      <div className="font-medium text-[#F0D9B5]">{q.prompt}</div>
                      <div className="text-[11px] text-[#D6C7DF]">Rubric: {q.rubric}</div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#6A5ACD]/25">
                        <button
                          type="button"
                          onClick={() =>
                            setInterviewSettings({
                              ...interviewSettings,
                              questions: interviewSettings.questions.map((item) =>
                                item.id === q.id ? { ...item, active: !item.active } : item
                              ),
                            })
                          }
                          className={q.active ? 'text-emerald-300' : 'text-[#A678B9]'}
                        >
                          {q.active ? 'Active in Pool' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setInterviewSettings({
                              ...interviewSettings,
                              questions: interviewSettings.questions.filter(
                                (item) => item.id !== q.id
                              ),
                            })
                          }
                          className="text-red-300 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Question Form */}
                <div className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/45 p-4 space-y-3 text-xs">
                  <div className="font-semibold text-[#F0D9B5]">Add New Interview Question</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={newQuestionCategory}
                      onChange={(e) => setNewQuestionCategory(e.target.value)}
                      className="rounded-lg border border-[#6A5ACD]/45 bg-[#2D2B55] px-3 py-2 text-[#F0D9B5]"
                    >
                      {interviewSettings.categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newQuestionDifficulty}
                      onChange={(e) => setNewQuestionDifficulty(e.target.value)}
                      className="rounded-lg border border-[#6A5ACD]/45 bg-[#2D2B55] px-3 py-2 text-[#F0D9B5]"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={newQuestionPrompt}
                    onChange={(e) => setNewQuestionPrompt(e.target.value)}
                    placeholder="Question prompt asked to the student..."
                    className="w-full rounded-lg border border-[#6A5ACD]/45 bg-[#2D2B55] px-3 py-2 text-[#F0D9B5]"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newQuestionRubric}
                      onChange={(e) => setNewQuestionRubric(e.target.value)}
                      placeholder="Evaluation rubric guidance..."
                      className="flex-1 rounded-lg border border-[#6A5ACD]/45 bg-[#2D2B55] px-3 py-2 text-[#F0D9B5]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newQuestionPrompt.trim()) return;
                        setInterviewSettings({
                          ...interviewSettings,
                          questions: [
                            ...interviewSettings.questions,
                            {
                              id: `q-${Date.now()}`,
                              category: newQuestionCategory,
                              difficulty: newQuestionDifficulty,
                              prompt: newQuestionPrompt.trim(),
                              rubric:
                                newQuestionRubric.trim() ||
                                'Evaluate clarity, evidence, and trade-off awareness.',
                              active: true,
                            },
                          ],
                        });
                        setNewQuestionPrompt('');
                        setNewQuestionRubric('');
                      }}
                      className="rounded-lg bg-[#F4A62A] px-4 py-2 font-semibold text-[#1A1A1F]"
                    >
                      Add Question
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* F. AI RECOMMENDATION MANAGEMENT */}
          {section === 'ai-recommendations' && recSettings && (
            <div className="space-y-6">
              <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#6A5ACD]/35 pb-4">
                  <div>
                    <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                      Recommendation Criteria Weights & Explanations
                    </h2>
                    <p className="text-xs text-[#D6C7DF]">
                      Configure how Vectora weights ability scores, stream eligibility, and career-to-skill fit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await saveAdminRecommendationConfig(recSettings);
                      notify('ok', 'Recommendation criteria & weights saved.');
                    }}
                    className="rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F] hover:bg-[#F7B64C]"
                  >
                    Save Recommendation Rules
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  {(
                    [
                      ['abilityMatch', 'Ability Assessment Weight (%)'],
                      ['interestAlignment', 'Interests & Hobbies Weight (%)'],
                      ['academicEligibility', 'Academic Stream & Grade (%)'],
                      ['growthOutlook', 'Market Growth Outlook (%)'],
                    ] as const
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-4 space-y-2"
                    >
                      <div className="text-[#D6C7DF]">{label}</div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={recSettings.scoringWeights[key]}
                        onChange={(e) =>
                          setRecSettings({
                            ...recSettings,
                            scoringWeights: {
                              ...recSettings.scoringWeights,
                              [key]: Number(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-[#6A5ACD]/50 bg-[#2D2B55] px-3 py-2 font-mono font-bold text-[#F4A62A]"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-[#F0D9B5] mb-1.5">
                      Recommendation Explanation Guidance
                    </label>
                    <textarea
                      rows={3}
                      value={recSettings.explanationTemplate}
                      onChange={(e) =>
                        setRecSettings({ ...recSettings, explanationTemplate: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] p-3 text-[#F0D9B5]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#F0D9B5] mb-1.5">
                      Quality Audit Notes
                    </label>
                    <textarea
                      rows={3}
                      value={recSettings.qualityAuditNotes}
                      onChange={(e) =>
                        setRecSettings({ ...recSettings, qualityAuditNotes: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] p-3 text-[#F0D9B5]"
                    />
                  </div>
                </div>
              </div>

              {/* Flag Inaccurate Suggestions Queue */}
              <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4 text-xs">
                <h3 className="text-base font-display font-bold text-[#F0D9B5]">
                  Flagged Career Suggestions & Quality Review
                </h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={flagCareerId}
                    onChange={(e) => setFlagCareerId(e.target.value)}
                    className="rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                  >
                    <option value="">Select Career to Flag...</option>
                    {careers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="Reason recommendation looked inaccurate or mismatched..."
                    className="flex-1 rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!flagCareerId || !flagReason.trim()) return;
                      const updated: AdminRecommendationSettings = {
                        ...recSettings,
                        flaggedSuggestions: [
                          {
                            id: `flag-${Date.now()}`,
                            careerId: flagCareerId,
                            reason: flagReason.trim(),
                            status: 'open',
                            createdAt: new Date().toISOString(),
                          },
                          ...recSettings.flaggedSuggestions,
                        ],
                      };
                      setRecSettings(updated);
                      await saveAdminRecommendationConfig(updated);
                      setFlagReason('');
                      notify('ok', 'Recommendation quality flag logged.');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4A62A] px-4 py-2 font-semibold text-[#1A1A1F]"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Flag Suggestion</span>
                  </button>
                </div>

                {recSettings.flaggedSuggestions.length === 0 ? (
                  <div className="text-[#D6C7DF]">No flagged recommendations pending review.</div>
                ) : (
                  <div className="space-y-2">
                    {recSettings.flaggedSuggestions.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-3"
                      >
                        <div>
                          <div className="font-semibold text-[#F0D9B5]">{item.careerId}</div>
                          <div className="text-[#D6C7DF]">{item.reason}</div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const updated: AdminRecommendationSettings = {
                              ...recSettings,
                              flaggedSuggestions: recSettings.flaggedSuggestions.map((f) =>
                                f.id === item.id
                                  ? { ...f, status: f.status === 'open' ? 'resolved' : 'open' }
                                  : f
                              ),
                            };
                            setRecSettings(updated);
                            await saveAdminRecommendationConfig(updated);
                          }}
                          className={`rounded-lg px-3 py-1 font-mono uppercase ${
                            item.status === 'open'
                              ? 'bg-[#F4A62A]/20 text-[#F4A62A]'
                              : 'bg-emerald-950/60 text-emerald-300'
                          }`}
                        >
                          {item.status}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* G. 3D WORLD MANAGEMENT */}
          {section === 'worlds' && (
            <div className="space-y-6">
              <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                      3D Career World Environments & Interactive Assets
                    </h2>
                    <p className="text-xs text-[#D6C7DF]">
                      Manage campus locations, interactive objects, student activities, and 3D world assets.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingEnv({
                        buildingId: `building-custom-${Date.now()}`,
                        name: '',
                        careerId: 'all',
                        stageType: 'mid_years',
                        themeColor: '#F4A62A',
                        description: '',
                        interactiveObjects: ['Interactive Simulation Terminal'],
                        activities: ['Hands-on Lab Walkthrough'],
                        assets: ['custom_pavilion_mesh'],
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Environment</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {environments.map((env) => (
                    <div
                      key={env.buildingId}
                      className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#F4A62A]">{env.stageType}</span>
                        <span className="text-[#A678B9]">{env.buildingId}</span>
                      </div>
                      <div className="text-sm font-display font-bold text-[#F0D9B5]">{env.name}</div>
                      <p className="text-[#D6C7DF]">{env.description}</p>
                      <div className="text-[11px] text-[#D6C7DF]">
                        <span className="text-[#A678B9]">Objects:</span>{' '}
                        {env.interactiveObjects.join(', ')}
                      </div>
                      <div className="text-[11px] text-[#D6C7DF]">
                        <span className="text-[#A678B9]">Activities:</span>{' '}
                        {env.activities.join(', ')}
                      </div>
                      <div className="text-[11px] text-[#D6C7DF]">
                        <span className="text-[#A678B9]">Assets:</span> {env.assets.join(', ')}
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-[#6A5ACD]/25">
                        <button
                          type="button"
                          onClick={() => setEditingEnv(env)}
                          className="rounded-lg border border-[#6A5ACD]/55 bg-[#2D2B55] px-3 py-1.5 font-semibold text-[#F0D9B5]"
                        >
                          Edit World
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await removeAdminEnvironment(env.buildingId);
                            notify('ok', `Removed environment "${env.name}".`);
                            loadSectionData('worlds');
                          }}
                          className="rounded-lg border border-red-400/40 bg-red-950/40 p-1.5 text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {editingEnv && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await saveAdminEnvironment(editingEnv);
                    notify('ok', `Saved 3D environment "${editingEnv.name}".`);
                    setEditingEnv(null);
                    onCatalogChanged();
                    loadSectionData('worlds');
                  }}
                  className="bg-[#2D2B55] border border-[#F4A62A]/60 rounded-2xl p-6 space-y-4 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-display font-bold text-[#F0D9B5]">
                      Configure 3D World Environment
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingEnv(null)}
                      className="text-[#D6C7DF]"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      type="text"
                      required
                      value={editingEnv.name}
                      onChange={(e) => setEditingEnv({ ...editingEnv, name: e.target.value })}
                      placeholder="Location Name"
                      className="rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                    />
                    <select
                      value={editingEnv.stageType}
                      onChange={(e) => setEditingEnv({ ...editingEnv, stageType: e.target.value })}
                      className="rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                    >
                      <option value="twelfth">twelfth</option>
                      <option value="first_year">first_year</option>
                      <option value="mid_years">mid_years</option>
                      <option value="final_year">final_year</option>
                      <option value="workplace">workplace</option>
                    </select>
                    <input
                      type="text"
                      value={editingEnv.themeColor}
                      onChange={(e) => setEditingEnv({ ...editingEnv, themeColor: e.target.value })}
                      placeholder="#F4A62A"
                      className="rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 font-mono text-[#F0D9B5]"
                    />
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={editingEnv.description}
                    onChange={(e) => setEditingEnv({ ...editingEnv, description: e.target.value })}
                    placeholder="Environment description..."
                    className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] p-3 text-[#F0D9B5]"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-semibold text-[#F0D9B5] mb-1">
                        Interactive Objects (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={editingEnv.interactiveObjects.join(', ')}
                        onChange={(e) =>
                          setEditingEnv({
                            ...editingEnv,
                            interactiveObjects: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#F0D9B5] mb-1">
                        Activities (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={editingEnv.activities.join(', ')}
                        onChange={(e) =>
                          setEditingEnv({
                            ...editingEnv,
                            activities: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#F0D9B5] mb-1">
                        Environment Assets (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={editingEnv.assets.join(', ')}
                        onChange={(e) =>
                          setEditingEnv({
                            ...editingEnv,
                            assets: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-xl bg-[#F4A62A] px-5 py-2 font-semibold text-[#1A1A1F]"
                    >
                      Save 3D Environment
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* H. MISSION MANAGEMENT */}
          {section === 'missions' && (
            <div className="space-y-6">
              <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                      Career Missions & Evaluation Criteria
                    </h2>
                    <p className="text-xs text-[#D6C7DF]">
                      Create missions, assign to 3D career worlds, configure difficulty & completion criteria.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingMission({
                        missionKey: `mission-${Date.now()}`,
                        careerId: careers[0]?.id || 'ai-systems-engineer',
                        buildingId: environments[0]?.buildingId || 'building-admissions',
                        stageType: 'twelfth',
                        title: '',
                        category: 'project',
                        difficulty: 'Intermediate',
                        summary: '',
                        scenarioContext: '',
                        taskPrompt: '',
                        evaluationCriteria: ['Clear decomposition', 'Practical verification'],
                        skillRewards: { 'Analytical Reasoning': 8 },
                        qualityRating: 5,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Mission</span>
                  </button>
                </div>

                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#6A5ACD]/35 text-[#A678B9]">
                        <th className="py-2 pr-3">Title</th>
                        <th className="py-2 px-3">Career & World</th>
                        <th className="py-2 px-3">Difficulty</th>
                        <th className="py-2 px-3 text-right">Quality</th>
                        <th className="py-2 pl-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#6A5ACD]/20">
                      {missions.slice(0, 20).map((m) => (
                        <tr key={m.missionKey} className="hover:bg-[#1A1A1F]/40">
                          <td className="py-3 pr-3">
                            <div className="font-semibold text-[#F0D9B5]">{m.title}</div>
                            <div className="text-[11px] text-[#D6C7DF] line-clamp-1">{m.summary}</div>
                          </td>
                          <td className="py-3 px-3 text-[#D6C7DF]">
                            <div>{m.careerId}</div>
                            <div className="text-[11px] text-[#A678B9]">{m.buildingId}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[#F4A62A]">{m.difficulty}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-[#F0D9B5]">
                            {m.qualityRating}/5
                          </td>
                          <td className="py-3 pl-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => setEditingMission(m)}
                              className="rounded-lg border border-[#6A5ACD]/55 bg-[#1A1A1F] px-2.5 py-1 text-[#F0D9B5]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await removeAdminMission(m.missionKey);
                                notify('ok', `Deleted mission "${m.title}".`);
                                loadSectionData('missions');
                              }}
                              className="text-red-300 hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {editingMission && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await saveAdminMission(editingMission);
                    notify('ok', `Saved mission "${editingMission.title}".`);
                    setEditingMission(null);
                    loadSectionData('missions');
                  }}
                  className="bg-[#2D2B55] border border-[#F4A62A]/60 rounded-2xl p-6 space-y-4 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-display font-bold text-[#F0D9B5]">
                      Configure Mission & Completion Rubric
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingMission(null)}
                      className="text-[#D6C7DF]"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <input
                      type="text"
                      required
                      value={editingMission.title}
                      onChange={(e) =>
                        setEditingMission({ ...editingMission, title: e.target.value })
                      }
                      placeholder="Mission Title"
                      className="sm:col-span-2 rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                    />
                    <select
                      value={editingMission.careerId}
                      onChange={(e) =>
                        setEditingMission({ ...editingMission, careerId: e.target.value })
                      }
                      className="rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                    >
                      {careers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editingMission.difficulty}
                      onChange={(e) =>
                        setEditingMission({
                          ...editingMission,
                          difficulty: e.target.value as ManagedMissionRecord['difficulty'],
                        })
                      }
                      className="rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <select
                      value={editingMission.buildingId}
                      onChange={(e) =>
                        setEditingMission({ ...editingMission, buildingId: e.target.value })
                      }
                      className="rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                    >
                      {environments.map((ev) => (
                        <option key={ev.buildingId} value={ev.buildingId}>
                          {ev.name} ({ev.buildingId})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={editingMission.qualityRating}
                      onChange={(e) =>
                        setEditingMission({
                          ...editingMission,
                          qualityRating: Math.min(5, Math.max(1, Number(e.target.value) || 5)),
                        })
                      }
                      placeholder="Feedback Quality Rating (1-5)"
                      className="rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                    />
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={editingMission.taskPrompt}
                    onChange={(e) =>
                      setEditingMission({ ...editingMission, taskPrompt: e.target.value })
                    }
                    placeholder="Mission instructions / prompt..."
                    className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] p-3 text-[#F0D9B5]"
                  />
                  <input
                    type="text"
                    value={editingMission.evaluationCriteria.join(', ')}
                    onChange={(e) =>
                      setEditingMission({
                        ...editingMission,
                        evaluationCriteria: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Completion criteria (comma-separated)"
                    className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-xl bg-[#F4A62A] px-5 py-2 font-semibold text-[#1A1A1F]"
                    >
                      Save Mission
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* I. ROADMAP & EDUCATION MANAGEMENT */}
          {section === 'roadmaps' && (
            <div className="space-y-6">
              <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                      Education Pathways, Entrance Exams, Scholarships & Links
                    </h2>
                    <p className="text-xs text-[#D6C7DF]">
                      Maintain verified qualification criteria, degree options, scholarships, and official portals.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingRoadmap({
                        pathwayKey: `pathway-${Date.now()}`,
                        careerId: careers[0]?.id || 'ai-systems-engineer',
                        stageType: 'twelfth',
                        title: '',
                        qualificationRequirements: '',
                        courses: ['B.Tech / B.S. Honors'],
                        entranceExams: ['National Entrance Test'],
                        collegesAndScholarships: [
                          {
                            id: `sch-${Date.now()}`,
                            institution: 'National University Alliance',
                            scholarshipName: 'Merit Excellence Grant',
                            eligibility: 'Top 15% qualifying percentile',
                            deadline: 'Annual · October',
                            url: 'https://scholarships.gov.in',
                          },
                        ],
                        externalLinks: [
                          {
                            id: `lnk-${Date.now()}`,
                            label: 'Official Counselling Portal',
                            url: 'https://www.education.gov.in',
                          },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4A62A] px-4 py-2 text-xs font-semibold text-[#1A1A1F]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Pathway</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {roadmaps.map((rm) => (
                    <div
                      key={rm.pathwayKey}
                      className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#F4A62A]">{rm.careerId}</span>
                        <span className="text-[#A678B9]">{rm.stageType}</span>
                      </div>
                      <div className="text-sm font-display font-bold text-[#F0D9B5]">{rm.title}</div>
                      <div className="text-[#D6C7DF]">{rm.qualificationRequirements}</div>
                      <div className="text-[11px] text-[#D6C7DF]">
                        Courses: {rm.courses.join(', ')}
                      </div>
                      <div className="text-[11px] text-[#D6C7DF]">
                        Exams: {rm.entranceExams.join(', ')}
                      </div>
                      {rm.externalLinks.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {rm.externalLinks.map((lk) => (
                            <a
                              key={lk.id}
                              href={sanitizeExternalUrl(lk.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-[#F4A62A] hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{lk.label}</span>
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-end gap-2 pt-2 border-t border-[#6A5ACD]/25">
                        <button
                          type="button"
                          onClick={() => setEditingRoadmap(rm)}
                          className="rounded-lg border border-[#6A5ACD]/55 bg-[#2D2B55] px-3 py-1.5 font-semibold text-[#F0D9B5]"
                        >
                          Edit Pathway
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await removeAdminRoadmap(rm.pathwayKey);
                            notify('ok', `Removed pathway "${rm.title}".`);
                            loadSectionData('roadmaps');
                          }}
                          className="rounded-lg border border-red-400/40 bg-red-950/40 p-1.5 text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {editingRoadmap && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await saveAdminRoadmap(editingRoadmap);
                    notify('ok', `Saved education pathway "${editingRoadmap.title}".`);
                    setEditingRoadmap(null);
                    loadSectionData('roadmaps');
                  }}
                  className="bg-[#2D2B55] border border-[#F4A62A]/60 rounded-2xl p-6 space-y-4 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-display font-bold text-[#F0D9B5]">
                      Edit Education Pathway & Scholarships
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingRoadmap(null)}
                      className="text-[#D6C7DF]"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      type="text"
                      required
                      value={editingRoadmap.title}
                      onChange={(e) =>
                        setEditingRoadmap({ ...editingRoadmap, title: e.target.value })
                      }
                      placeholder="Pathway Title"
                      className="sm:col-span-2 rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                    />
                    <select
                      value={editingRoadmap.stageType}
                      onChange={(e) =>
                        setEditingRoadmap({
                          ...editingRoadmap,
                          stageType: e.target.value as StageType,
                        })
                      }
                      className="rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                    >
                      <option value="twelfth">twelfth</option>
                      <option value="first_year">first_year</option>
                      <option value="mid_years">mid_years</option>
                      <option value="final_year">final_year</option>
                      <option value="workplace">workplace</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    required
                    value={editingRoadmap.qualificationRequirements}
                    onChange={(e) =>
                      setEditingRoadmap({
                        ...editingRoadmap,
                        qualificationRequirements: e.target.value,
                      })
                    }
                    placeholder="Qualification Requirements..."
                    className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={editingRoadmap.courses.join(', ')}
                      onChange={(e) =>
                        setEditingRoadmap({
                          ...editingRoadmap,
                          courses: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Courses (comma-separated)"
                      className="rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                    />
                    <input
                      type="text"
                      value={editingRoadmap.entranceExams.join(', ')}
                      onChange={(e) =>
                        setEditingRoadmap({
                          ...editingRoadmap,
                          entranceExams: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Entrance Exams (comma-separated)"
                      className="rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-xl bg-[#F4A62A] px-5 py-2 font-semibold text-[#1A1A1F]"
                    >
                      Save Education Pathway
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 9. REPORTS, ANALYTICS, INVITATIONS & PLATFORM SETTINGS */}
          {section === 'reports' && (
            <div className="space-y-6">
              {overview && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
                      <div className="text-xs text-[#D6C7DF]">Active Users (24h)</div>
                      <div className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-[#F4A62A]">
                        {overview.platformUsage.activeToday}
                      </div>
                    </div>
                    <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
                      <div className="text-xs text-[#D6C7DF]">AI Interviews Completed</div>
                      <div className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-[#F0D9B5]">
                        {overview.platformUsage.interviewsCompleted}
                      </div>
                    </div>
                    <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
                      <div className="text-xs text-[#D6C7DF]">Roadmaps Generated</div>
                      <div className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-[#F0D9B5]">
                        {overview.platformUsage.roadmapsGenerated}
                      </div>
                    </div>
                    <div className="bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-5">
                      <div className="text-xs text-[#D6C7DF]">3D Worlds Explored</div>
                      <div className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-[#F4A62A]">
                        {overview.platformUsage.worldsExplored}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Most Completed Missions */}
                    <div className="lg:col-span-6 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4 text-xs">
                      <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                        Most Completed Missions & Completion Quality
                      </h2>
                      {overview.mostCompletedMissions.length === 0 ? (
                        <div className="text-[#D6C7DF]">No completed student missions logged yet.</div>
                      ) : (
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-[#6A5ACD]/35 text-[#A678B9]">
                              <th className="py-2 pr-3">Mission</th>
                              <th className="py-2 px-3 text-right">Completions</th>
                              <th className="py-2 pl-3 text-right">Avg Score</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#6A5ACD]/20">
                            {overview.mostCompletedMissions.map((m) => (
                              <tr key={m.missionId}>
                                <td className="py-2.5 pr-3 text-[#F0D9B5] font-medium">{m.title}</td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#F4A62A]">
                                  {m.completions}
                                </td>
                                <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-emerald-300">
                                  {m.avgScore}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Errors & Content Requiring Review */}
                    <div className="lg:col-span-6 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4 text-xs">
                      <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                        Errors & Content Requiring Review
                      </h2>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={newIssueArea}
                          onChange={(e) => setNewIssueArea(e.target.value)}
                          placeholder="Area"
                          className="sm:w-32 rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                        />
                        <select
                          value={newIssueSeverity}
                          onChange={(e) =>
                            setNewIssueSeverity(e.target.value as 'low' | 'medium' | 'high')
                          }
                          className="rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                        <input
                          type="text"
                          value={newIssueMsg}
                          onChange={(e) => setNewIssueMsg(e.target.value)}
                          placeholder="Describe issue or content needing audit..."
                          className="flex-1 rounded-xl border border-[#6A5ACD]/45 bg-[#1A1A1F] px-3 py-2 text-[#F0D9B5]"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!newIssueMsg.trim()) return;
                            await createAdminIssue({
                              area: newIssueArea,
                              severity: newIssueSeverity,
                              message: newIssueMsg.trim(),
                            });
                            setNewIssueMsg('');
                            notify('ok', 'Review item added.');
                            loadSectionData('reports');
                          }}
                          className="rounded-xl bg-[#F4A62A] px-4 py-2 font-semibold text-[#1A1A1F]"
                        >
                          Log
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {overview.issues.map((issue) => (
                          <div
                            key={issue.id}
                            className="flex items-start justify-between gap-3 rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-3.5"
                          >
                            <div className="flex items-start gap-2.5">
                              <AlertTriangle
                                className={`w-4 h-4 shrink-0 mt-0.5 ${
                                  issue.severity === 'high' ? 'text-red-400' : 'text-[#F4A62A]'
                                }`}
                              />
                              <div>
                                <div className="font-semibold text-[#F0D9B5]">
                                  {issue.area} · <span className="uppercase">{issue.severity}</span>
                                </div>
                                <div className="text-[#D6C7DF] mt-0.5">{issue.message}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await updateAdminIssueStatus(
                                  issue.id,
                                  issue.status === 'open' ? 'resolved' : 'open'
                                );
                                loadSectionData('reports');
                              }}
                              className={`rounded-lg px-2.5 py-1 font-mono uppercase shrink-0 ${
                                issue.status === 'open'
                                  ? 'bg-[#F4A62A]/20 text-[#F4A62A]'
                                  : 'bg-emerald-950/60 text-emerald-300'
                              }`}
                            >
                              {issue.status}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Server-Side Admin Provisioning, RBAC Permissions & Account Settings */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-5 text-xs">
                  <div className="flex items-center gap-3 border-b border-[#6A5ACD]/35 pb-4">
                    <ShieldAlert className="w-5 h-5 text-[#F4A62A]" />
                    <div>
                      <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                        Authorized Admin Invitations & RBAC Scopes
                      </h2>
                      <p className="text-xs text-[#D6C7DF]">
                        Provision additional admins securely on the server. Public signup only creates STUDENT accounts.
                      </p>
                    </div>
                  </div>

                  {hasPermission('manage_security') && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!inviteEmail.trim()) return;
                        try {
                          const res = await createAdminInvitation({
                            email: inviteEmail.trim(),
                            permissions: ALL_PERMISSIONS.map((p) => p.id),
                          });
                          setInvitations([
                            res.invitation,
                            ...invitations.filter((i) => i.email !== res.invitation.email),
                          ]);
                          setInviteEmail('');
                          notify('ok', `Admin invitation created for ${res.invitation.email}.`);
                        } catch (err) {
                          notify('err', err instanceof Error ? err.message : 'Failed to invite admin.');
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Invite authorized email as Admin..."
                        className="flex-1 rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-[#F0D9B5]"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4A62A] px-4 py-2.5 font-semibold text-[#1A1A1F] hover:bg-[#F7B64C] whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Invite Admin</span>
                      </button>
                    </form>
                  )}

                  {invitations.length > 0 && (
                    <div className="space-y-2">
                      {invitations.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[#F0D9B5] truncate">{inv.email}</div>
                            <div className="text-[11px] text-[#D6C7DF]">
                              Status: <span className="font-mono text-[#F4A62A] uppercase">{inv.status}</span> · Invited by {inv.invitedByEmail}
                            </div>
                          </div>
                          {inv.status === 'pending' && hasPermission('manage_security') && (
                            <button
                              type="button"
                              onClick={async () => {
                                await revokeAdminInvitation(inv.id);
                                setInvitations(
                                  invitations.map((item) =>
                                    item.id === inv.id ? { ...item, status: 'revoked' } : item
                                  )
                                );
                                notify('ok', 'Invitation revoked.');
                              }}
                              className="rounded-lg border border-red-400/40 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-950/40"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#6A5ACD]/35">
                    {ALL_PERMISSIONS.map((perm) => {
                      const active = hasPermission(perm.id);
                      return (
                        <div
                          key={perm.id}
                          className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between ${
                            active
                              ? 'border-emerald-400/45 bg-emerald-950/35 text-emerald-200'
                              : 'border-[#6A5ACD]/35 bg-[#1A1A1F] text-[#D6C7DF]'
                          }`}
                        >
                          <span>{perm.label}</span>
                          <span className="font-mono text-[11px]">
                            {active ? 'GRANTED' : 'RESTRICTED'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await updateAdminAccount({
                        fullName: adminDisplayName,
                        newAdminPasscode: newAdminPasscode || undefined,
                      });
                      setNewAdminPasscode('');
                      notify('ok', 'Admin account and security settings updated.');
                      onSessionPromoted({ ...session, fullName: adminDisplayName });
                    } catch (err) {
                      notify('err', err instanceof Error ? err.message : 'Update failed.');
                    }
                  }}
                  className="lg:col-span-6 bg-[#2D2B55] border border-[#6A5ACD]/45 rounded-2xl p-6 space-y-4 text-xs"
                >
                  <h2 className="text-base font-display font-bold text-[#F0D9B5]">
                    Admin Account Settings & Passcode Rotation
                  </h2>
                  <div className="rounded-xl bg-[#1A1A1F] border border-[#6A5ACD]/40 p-3.5 text-[#D6C7DF]">
                    Server passcode source:{' '}
                    <span className="font-mono text-[#F4A62A]">
                      {securityStatus?.hasEnvCode
                        ? 'Environment Secret (ADMIN_ACCESS_CODE)'
                        : securityStatus?.isClaimed
                          ? 'Database Scrypt Hash'
                          : 'Firebase Verified Admin + Invitations'}
                    </span>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#F0D9B5] mb-1.5">
                      Admin Display Name
                    </label>
                    <input
                      type="text"
                      value={adminDisplayName}
                      onChange={(e) => setAdminDisplayName(e.target.value)}
                      className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-[#F0D9B5]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#F0D9B5] mb-1.5">
                      Set or Rotate Admin Access Passcode (optional)
                    </label>
                    <input
                      type="password"
                      minLength={6}
                      value={newAdminPasscode}
                      onChange={(e) => setNewAdminPasscode(e.target.value)}
                      placeholder="Leave blank to keep current policy"
                      className="w-full rounded-xl border border-[#6A5ACD]/50 bg-[#1A1A1F] px-3.5 py-2.5 text-[#F0D9B5]"
                    />
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="rounded-xl bg-[#F4A62A] px-5 py-2.5 font-semibold text-[#1A1A1F] hover:bg-[#F7B64C]"
                    >
                      Update Security Settings
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
