import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { AlertCircle, Loader2, Lock, ShieldCheck, X } from 'lucide-react';
import {
  fetchCareerRecommendations,
  fetchLiveCatalog,
  fetchWorkspaceState,
  generateCareerRoadmap,
  isAdminAuthInProgress,
  saveWorkspaceState,
  setInMemoryToken,
  signOutFirebase,
} from './api/client';
import { AdminDashboard, type AdminSection } from './components/AdminDashboard';
import { AdminLoginView } from './components/AdminLoginView';
import { AuthOnboarding } from './components/AuthOnboarding';
import { CareerExplorer } from './components/CareerExplorer';
import { CareerWorld3D } from './components/CareerWorld3D';
import { InterviewStudio } from './components/InterviewStudio';
import { MissionModal } from './components/MissionModal';
import { ProgressAndPivot } from './components/ProgressAndPivot';
import { RoadmapView } from './components/RoadmapView';
import { StudentAvatar, StudentDashboard } from './components/StudentDashboard';
import { CAREER_CATALOG } from './data/careers';
import { auth } from './lib/firebase';
import { isInterviewCompleted } from './lib/rbac';
import type {
  AppView,
  AuthSession,
  CareerDefinition,
  CareerMission,
  InterviewState,
  MentorMessage,
  MissionEvaluationResult,
  ProgressAnalytics,
  RoadmapStage,
  StudentProfile,
  StudentWorkspaceState,
} from './types';

const ADMIN_SECTIONS: AdminSection[] = [
  'overview',
  'students',
  'careers',
  'ai-interview',
  'ai-recommendations',
  'missions',
  'worlds',
  'roadmaps',
  'reports',
];

function isValidAdminSection(val: string | undefined): val is AdminSection {
  return Boolean(val && (ADMIN_SECTIONS as string[]).includes(val));
}

function parsePathname(pathname: string): { view: AppView; adminSection: AdminSection } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/admin/login') {
    return { view: 'admin_login', adminSection: 'overview' };
  }
  if (clean === '/admin' || clean.startsWith('/admin/')) {
    const seg = clean.slice('/admin'.length).replace(/^\//, '').split('/')[0];
    return {
      view: 'admin',
      adminSection: isValidAdminSection(seg) ? seg : 'overview',
    };
  }
  switch (clean) {
    case '/login':
      return { view: 'auth', adminSection: 'overview' };
    case '/profile':
      return { view: 'profile', adminSection: 'overview' };
    case '/dashboard':
      return { view: 'dashboard', adminSection: 'overview' };
    case '/interview':
      return { view: 'interview', adminSection: 'overview' };
    case '/explore':
      return { view: 'explore', adminSection: 'overview' };
    case '/roadmap':
      return { view: 'roadmap', adminSection: 'overview' };
    case '/world':
      return { view: 'world', adminSection: 'overview' };
    case '/progress':
      return { view: 'progress', adminSection: 'overview' };
    default:
      return { view: 'dashboard', adminSection: 'overview' };
  }
}

function buildPathForState(view: AppView, adminSection: AdminSection): string {
  switch (view) {
    case 'auth':
      return '/login';
    case 'admin_login':
      return '/admin/login';
    case 'admin':
      return `/admin/${adminSection}`;
    case 'profile':
      return '/profile';
    case 'dashboard':
      return '/dashboard';
    case 'interview':
      return '/interview';
    case 'explore':
      return '/explore';
    case 'roadmap':
      return '/roadmap';
    case 'world':
      return '/world';
    case 'progress':
      return '/progress';
    default:
      return '/login';
  }
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [workspace, setWorkspace] = useState<StudentWorkspaceState | null>(null);
  const [liveCareers, setLiveCareers] = useState<CareerDefinition[]>(CAREER_CATALOG);
  const [view, setView] = useState<AppView>(() => parsePathname(window.location.pathname).view);
  const [adminSection, setAdminSection] = useState<AdminSection>(
    () => parsePathname(window.location.pathname).adminSection
  );
  const [busyAction, setBusyAction] = useState(false);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [focusBuildingId, setFocusBuildingId] = useState<string | null>(null);
  const [activeMission, setActiveMission] = useState<{
    mission: CareerMission;
    stage: RoadmapStage;
  } | null>(null);

  const pendingSaveRef = useRef<Promise<unknown>>(Promise.resolve());
  const activeUidRef = useRef<string | null>(null);

  const syncHistory = useCallback(
    (nextView: AppView, nextSection: AdminSection = 'overview', replace = false) => {
      const targetPath = buildPathForState(nextView, nextSection);
      if (window.location.pathname !== targetPath) {
        if (replace) {
          window.history.replaceState(null, '', targetPath);
        } else {
          window.history.pushState(null, '', targetPath);
        }
      }
    },
    []
  );

  const navigateTo = useCallback(
    (nextView: AppView, nextSection?: AdminSection, replace = false) => {
      const resolvedSection = nextSection ?? adminSection;
      setView(nextView);
      if (nextSection) {
        setAdminSection(nextSection);
      }
      syncHistory(nextView, resolvedSection, replace);
    },
    [adminSection, syncHistory]
  );

  const refreshLiveCatalog = useCallback(async () => {
    try {
      const res = await fetchLiveCatalog();
      if (Array.isArray(res.careers) && res.careers.length > 0) {
        setLiveCareers(res.careers);
      }
    } catch {
      // Fallback safely to static catalog if offline/transient
    }
  }, []);

  /**
   * Role-based navigation enforcement for direct URL entry, refreshes, and popstate.
   */
  const enforceRoleRoute = useCallback(
    (
      requestedPath: string,
      nextSession: AuthSession | null,
      nextWorkspace: StudentWorkspaceState | null,
      replace = true
    ) => {
      const parsed = parsePathname(requestedPath);

      // Unauthenticated visitor
      if (!nextSession || !nextWorkspace) {
        if (parsed.view === 'admin_login') {
          navigateTo('admin_login', 'overview', replace);
          return;
        }
        if (parsed.view === 'admin') {
          setRouteNotice('Sign in with an authorized administrator account to access Admin Console.');
          navigateTo('admin_login', 'overview', replace);
          return;
        }
        navigateTo('auth', 'overview', replace);
        return;
      }

      // ADMIN role: strictly locked to Admin Dashboard
      if (nextSession.role === 'admin') {
        const targetSection = parsed.view === 'admin' ? parsed.adminSection : 'overview';
        navigateTo('admin', targetSection, replace);
        return;
      }

      // STUDENT role: deny any admin URLs & enforce interview-first gating
      if (parsed.view === 'admin' || parsed.view === 'admin_login') {
        setRouteNotice(
          'Access denied: Administrator permissions are required to access admin pages.'
        );
        const fallbackView: AppView = !nextWorkspace.profile?.curiosities ? 'profile' : 'dashboard';
        navigateTo(fallbackView, 'overview', replace);
        return;
      }

      if (!nextWorkspace.profile?.curiosities) {
        if (parsed.view !== 'profile') {
          navigateTo('profile', 'overview', replace);
          return;
        }
        navigateTo('profile', 'overview', replace);
        return;
      }

      const interviewDone = isInterviewCompleted(nextWorkspace.interview);
      const hasCareer = Boolean(nextWorkspace.selectedCareerId);

      if (
        (parsed.view === 'explore' ||
          parsed.view === 'roadmap' ||
          parsed.view === 'world' ||
          parsed.view === 'progress') &&
        !interviewDone
      ) {
        setRouteNotice(
          'Complete the AI interview first to unlock Explore Careers, Roadmap, 3D World, and Progress.'
        );
        navigateTo('interview', 'overview', replace);
        return;
      }

      if (
        (parsed.view === 'roadmap' || parsed.view === 'world' || parsed.view === 'progress') &&
        !hasCareer
      ) {
        setRouteNotice('Select a career path in Explore Careers to open your Roadmap and 3D World.');
        navigateTo('explore', 'overview', replace);
        return;
      }

      if (parsed.view === 'auth' || requestedPath === '/') {
        navigateTo('dashboard', 'overview', replace);
        return;
      }

      navigateTo(parsed.view, 'overview', replace);
    },
    [navigateTo]
  );

  // Sync Firebase Auth state on load, refresh, and account switch
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return;

      // Clear previous account data immediately whenever user state changes or signs out
      if (!fbUser || (activeUidRef.current && activeUidRef.current !== fbUser.uid)) {
        setSession(null);
        setWorkspace(null);
        setActiveMission(null);
        setFocusBuildingId(null);
      }

      if (!fbUser) {
        activeUidRef.current = null;
        setInMemoryToken(null);
        enforceRoleRoute(window.location.pathname, null, null, true);
        setBooting(false);
        return;
      }

      try {
        const idToken = await fbUser.getIdToken();
        setInMemoryToken(idToken);

        // If AdminLoginView is actively verifying /api/auth/admin-verify, let it finish cleanly
        if (isAdminAuthInProgress()) {
          return;
        }

        activeUidRef.current = fbUser.uid;
        const [res] = await Promise.all([fetchWorkspaceState(), refreshLiveCatalog()]);
        if (!active || isAdminAuthInProgress()) return;

        setSession(res.user);
        setWorkspace(res.workspace);
        enforceRoleRoute(window.location.pathname, res.user, res.workspace, true);
      } catch {
        if (!active) return;
        activeUidRef.current = null;
        setInMemoryToken(null);
        setSession(null);
        setWorkspace(null);
        enforceRoleRoute(window.location.pathname, null, null, true);
      } finally {
        if (active) setBooting(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [enforceRoleRoute, refreshLiveCatalog]);

  // Listen to browser Back/Forward URL changes and enforce RBAC
  useEffect(() => {
    const handlePopState = () => {
      enforceRoleRoute(window.location.pathname, session, workspace, true);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [enforceRoleRoute, session, workspace]);

  const persistWorkspace = useCallback((next: StudentWorkspaceState) => {
    setWorkspace(next);
    const chained = pendingSaveRef.current
      .catch(() => undefined)
      .then(() => saveWorkspaceState(next));
    pendingSaveRef.current = chained;
    chained.catch((err) => {
      console.error('Failed to persist workspace:', err);
    });
    return chained;
  }, []);

  const handleStudentAuthSuccess = (
    nextSession: AuthSession,
    nextWorkspace: StudentWorkspaceState
  ) => {
    setRouteNotice(null);
    activeUidRef.current = auth.currentUser?.uid ?? null;
    setSession(nextSession);
    setWorkspace(nextWorkspace);
    setActiveMission(null);
    setFocusBuildingId(null);
    void refreshLiveCatalog();

    if (nextSession.role === 'admin') {
      navigateTo('admin', 'overview');
      return;
    }
    if (!nextWorkspace.profile?.curiosities) {
      navigateTo('profile');
    } else {
      navigateTo('dashboard');
    }
  };

  const handleAdminAuthenticated = async (adminSession: AuthSession) => {
    setRouteNotice(null);
    activeUidRef.current = auth.currentUser?.uid ?? null;
    setSession(adminSession);
    setActiveMission(null);
    setFocusBuildingId(null);
    try {
      const [res] = await Promise.all([fetchWorkspaceState(), refreshLiveCatalog()]);
      setSession(res.user);
      setWorkspace(res.workspace);
      if (res.user.role === 'admin') {
        navigateTo('admin', 'overview');
      } else {
        setRouteNotice('Access denied: Administrator privileges required.');
        navigateTo('dashboard');
      }
    } catch {
      navigateTo('admin_login');
    }
  };

  const handleSignOut = async () => {
    const wasAdmin = session?.role === 'admin';
    activeUidRef.current = null;
    await signOutFirebase();
    setSession(null);
    setWorkspace(null);
    setActiveMission(null);
    setFocusBuildingId(null);
    setRouteNotice(null);
    navigateTo(wasAdmin ? 'admin_login' : 'auth');
  };

  const handleProfileComplete = (profile: StudentProfile) => {
    if (!workspace) return;
    persistWorkspace({ ...workspace, profile });
    if (session) {
      setSession({
        ...session,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl || session.avatarUrl,
      });
    }
    navigateTo('interview');
  };

  const handleSaveStudentDashboardProfile = (profile: StudentProfile) => {
    if (!workspace) return;
    persistWorkspace({ ...workspace, profile });
    if (session) {
      setSession({
        ...session,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl || session.avatarUrl,
      });
    }
  };

  const handleUpdateInterview = (interview: InterviewState) => {
    if (!workspace) return;
    persistWorkspace({ ...workspace, interview });
  };

  const handleGenerateRecommendations = async () => {
    if (!workspace?.profile) return;
    if (!isInterviewCompleted(workspace.interview)) {
      setRouteNotice('Complete the AI interview first to unlock personalized career exploration.');
      navigateTo('interview');
      return;
    }
    setBusyAction(true);
    setRouteNotice(null);
    try {
      // Wait for completed interview state to finish saving to PostgreSQL before backend verification
      await pendingSaveRef.current.catch(() => undefined);
      const res = await fetchCareerRecommendations(workspace.profile, workspace.interview);
      persistWorkspace({
        ...workspace,
        recommendations: res.recommendations,
      });
      navigateTo('explore');
    } catch (err) {
      setRouteNotice(
        err instanceof Error ? err.message : 'Unable to generate recommendations right now.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleCompare = (careerId: string) => {
    if (!workspace) return;
    const exists = workspace.compareCareerIds.includes(careerId);
    const nextIds = exists
      ? workspace.compareCareerIds.filter((id) => id !== careerId)
      : [...workspace.compareCareerIds, careerId].slice(-3);
    persistWorkspace({ ...workspace, compareCareerIds: nextIds });
  };

  const handleSelectCareer = async (careerId: string, enterWorldImmediately = false) => {
    if (!workspace?.profile) return;
    if (!isInterviewCompleted(workspace.interview)) {
      setRouteNotice('Complete the AI interview first before generating a career roadmap.');
      navigateTo('interview');
      return;
    }
    if (workspace.selectedCareerId === careerId && workspace.roadmap.length > 0) {
      setFocusBuildingId('building-admissions');
      navigateTo(enterWorldImmediately ? 'world' : 'roadmap');
      return;
    }
    setBusyAction(true);
    setRouteNotice(null);
    try {
      await pendingSaveRef.current.catch(() => undefined);
      const res = await generateCareerRoadmap(
        careerId,
        workspace.profile,
        workspace.advancedUnlocked
      );
      const unlockedBuildings = res.roadmap
        .filter((st) => st.unlocked)
        .map((st) => st.buildingId);

      persistWorkspace({
        ...workspace,
        selectedCareerId: careerId,
        roadmap: res.roadmap,
        unlockedBuildingIds: Array.from(new Set(['building-mentor', ...unlockedBuildings])),
        satisfactionStatus: 'undecided',
      });
      setFocusBuildingId('building-admissions');
      navigateTo(enterWorldImmediately ? 'world' : 'roadmap');
    } catch (err) {
      setRouteNotice(
        err instanceof Error ? err.message : 'Unable to unlock selected career pathway.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleMilestone = (stageId: string, milestoneId: string) => {
    if (!workspace) return;
    const nextRoadmap = workspace.roadmap.map((st) =>
      st.id !== stageId
        ? st
        : {
            ...st,
            milestones: st.milestones.map((ms) =>
              ms.id === milestoneId ? { ...ms, completed: !ms.completed } : ms
            ),
          }
    );
    persistWorkspace({ ...workspace, roadmap: nextRoadmap });
  };

  const handleMissionEvaluated = (result: MissionEvaluationResult) => {
    if (!workspace) return;

    const nextResults = {
      ...workspace.missionResults,
      [result.missionId]: result,
    };

    const nextSkills = { ...workspace.skills };
    Object.entries(result.skillDeltas).forEach(([skill, delta]) => {
      nextSkills[skill] = Math.min(100, (nextSkills[skill] ?? 50) + delta);
    });

    const nextCompletedIds = result.passed
      ? Array.from(new Set([...workspace.completedMissionIds, result.missionId]))
      : workspace.completedMissionIds;

    // Unlock next career stage & new 3D environment when current stage missions complete
    const nextRoadmap = [...workspace.roadmap];
    const nextUnlockedBuildings = new Set(workspace.unlockedBuildingIds);

    if (result.passed) {
      for (let i = 0; i < nextRoadmap.length; i++) {
        const st = nextRoadmap[i];
        const stagePassed = st.missions.every((m) => nextCompletedIds.includes(m.id));
        if (stagePassed) {
          nextRoadmap[i] = {
            ...st,
            completed: true,
            milestones: st.milestones.map((ms) => ({ ...ms, completed: true })),
          };
          if (i + 1 < nextRoadmap.length) {
            nextRoadmap[i + 1] = { ...nextRoadmap[i + 1], unlocked: true };
            nextUnlockedBuildings.add(nextRoadmap[i + 1].buildingId);
          }
        }
      }
    }

    persistWorkspace({
      ...workspace,
      missionResults: nextResults,
      skills: nextSkills,
      completedMissionIds: nextCompletedIds,
      roadmap: nextRoadmap,
      unlockedBuildingIds: Array.from(nextUnlockedBuildings),
    });
  };

  const handleUpdateMentorHistory = (mentorHistory: MentorMessage[]) => {
    if (!workspace) return;
    persistWorkspace({ ...workspace, mentorHistory });
  };

  const handleUpdateAnalytics = (progressAnalytics: ProgressAnalytics) => {
    if (!workspace) return;
    persistWorkspace({ ...workspace, progressAnalytics });
  };

  const handleSatisfiedContinue = async () => {
    if (!workspace?.profile || !workspace.selectedCareerId) return;
    await pendingSaveRef.current.catch(() => undefined);
    const res = await generateCareerRoadmap(workspace.selectedCareerId, workspace.profile, true);
    const mergedRoadmap = res.roadmap.map((st, idx) => {
      const prev = workspace.roadmap[idx];
      return {
        ...st,
        unlocked: prev ? prev.unlocked : st.unlocked,
        completed: prev ? prev.completed : st.completed,
        milestones: st.milestones.map((ms, mIdx) => ({
          ...ms,
          completed: prev?.milestones[mIdx]?.completed ?? ms.completed,
        })),
      };
    });

    persistWorkspace({
      ...workspace,
      satisfactionStatus: 'satisfied',
      advancedUnlocked: true,
      roadmap: mergedRoadmap,
    });
  };

  const handleMarkSessionWatched = useCallback(
    (watchId: string) => {
      setWorkspace((prev) => {
        if (!prev) return prev;
        const current = prev.watchedVideoSessionIds || [];
        if (current.includes(watchId)) return prev;
        const next: StudentWorkspaceState = {
          ...prev,
          watchedVideoSessionIds: [...current, watchId],
        };
        const chained = pendingSaveRef.current
          .catch(() => undefined)
          .then(() => saveWorkspaceState(next));
        pendingSaveRef.current = chained;
        return next;
      });
    },
    []
  );

  const handleComplete3DActivity = useCallback(
    (activityId: string) => {
      setWorkspace((prev) => {
        if (!prev) return prev;
        const current = prev.completed3DActivityIds || [];
        if (current.includes(activityId)) return prev;
        const next: StudentWorkspaceState = {
          ...prev,
          completed3DActivityIds: [...current, activityId],
        };
        const chained = pendingSaveRef.current
          .catch(() => undefined)
          .then(() => saveWorkspaceState(next));
        pendingSaveRef.current = chained;
        return next;
      });
    },
    []
  );

  const handlePivotCareer = async (newCareerId: string) => {
    await handleSelectCareer(newCareerId, false);
  };

  const selectedCareer =
    liveCareers.find((c) => c.id === workspace?.selectedCareerId) || null;
  const interviewCompleted = isInterviewCompleted(workspace?.interview);

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A1F]">
        <div className="flex items-center gap-3 text-sm font-medium text-[#F0D9B5]">
          <Loader2 className="w-4 h-4 animate-spin text-[#F4A62A]" />
          <span>Loading Vectora workspace...</span>
        </div>
      </div>
    );
  }

  // Exact 6 Student Navigation Sections (Admin Console completely removed from student nav)
  const studentNavItems: {
    id: AppView;
    label: string;
    enabled: boolean;
    lockedByInterview?: boolean;
  }[] = [
    { id: 'dashboard', label: 'Homepage', enabled: Boolean(session && workspace) },
    { id: 'interview', label: 'Interview', enabled: Boolean(session && workspace?.profile) },
    {
      id: 'explore',
      label: 'Explore Careers',
      enabled: Boolean(session && workspace?.profile && interviewCompleted),
      lockedByInterview: !interviewCompleted,
    },
    {
      id: 'roadmap',
      label: 'Roadmap',
      enabled: Boolean(session && interviewCompleted && selectedCareer),
      lockedByInterview: !interviewCompleted,
    },
    {
      id: 'world',
      label: '3D World',
      enabled: Boolean(session && interviewCompleted && selectedCareer),
      lockedByInterview: !interviewCompleted,
    },
    {
      id: 'progress',
      label: 'Progress',
      enabled: Boolean(session && interviewCompleted && selectedCareer),
      lockedByInterview: !interviewCompleted,
    },
  ];

  const handleStudentNavClick = async (item: {
    id: AppView;
    enabled: boolean;
    lockedByInterview?: boolean;
  }) => {
    if (!item.enabled) {
      if (item.lockedByInterview) {
        setRouteNotice(
          'Complete the AI interview first to unlock Explore Careers, Roadmap, 3D World, and Progress.'
        );
        navigateTo('interview');
      }
      return;
    }
    setRouteNotice(null);
    if (item.id === 'explore' && workspace?.recommendations.length === 0) {
      await handleGenerateRecommendations();
    } else {
      navigateTo(item.id);
    }
  };

  const isAdminUser = session?.role === 'admin';
  const showAuthenticatedHeader = Boolean(
    session && workspace && view !== 'auth' && view !== 'admin_login'
  );

  return (
    <div className="min-h-screen flex flex-col text-[#F0D9B5]">
      {showAuthenticatedHeader && session && workspace && (
        <header className="sticky top-0 z-40 bg-[#1A1A1F]/95 border-b border-[#6A5ACD]/35">
          <div className="mx-auto max-w-7xl h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
            {/* Zone 1: Brand Title */}
            <button
              type="button"
              onClick={() =>
                isAdminUser ? navigateTo('admin', 'overview') : navigateTo('dashboard')
              }
              className="text-base sm:text-lg font-display font-bold tracking-tight text-[#F0D9B5] whitespace-nowrap shrink-0 hover:text-[#F4A62A] transition-colors"
            >
              Vectora
            </button>

            {/* Zone 2: Strictly separated navigation per role */}
            {isAdminUser ? (
              <div className="hidden md:flex items-center gap-2 text-xs font-mono text-[#F4A62A]">
                <ShieldCheck className="w-4 h-4" />
                <span>Vectora Administrator Console</span>
              </div>
            ) : (
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                {studentNavItems.map((item) => {
                  const active = view === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.enabled && !item.lockedByInterview}
                      title={
                        item.lockedByInterview
                          ? 'Complete the AI Interview to unlock'
                          : undefined
                      }
                      onClick={() => handleStudentNavClick(item)}
                      className={`relative inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 py-5 text-[13px] transition-colors ${
                        active
                          ? 'text-[#F0D9B5] font-semibold'
                          : item.enabled
                            ? 'text-[#D6C7DF] hover:text-[#F0D9B5]'
                            : 'text-[#6A5ACD]/55 cursor-not-allowed'
                      }`}
                    >
                      {item.lockedByInterview && <Lock className="w-3 h-3 text-[#F4A62A]/80" />}
                      <span>{item.label}</span>
                      {active && (
                        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#F4A62A] shadow-[0_0_12px_rgba(244,166,42,0.65)]" />
                      )}
                    </button>
                  );
                })}
              </nav>
            )}

            {/* Zone 3: Identity Badge & Sign Out */}
            <div className="flex items-center gap-2.5 shrink-0">
              {isAdminUser ? (
                <div className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-[#F4A62A]/50 bg-[#2D2B55] px-3 py-1.5 text-xs font-medium text-[#F0D9B5] shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#F4A62A]" />
                  <span className="max-w-[160px] truncate">{session.fullName || session.email}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateTo('dashboard')}
                  title="Open Student Homepage & Profile"
                  className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-[#6A5ACD]/50 bg-[#2D2B55] px-2.5 py-1.5 text-xs font-medium text-[#F0D9B5] hover:border-[#A678B9] transition-colors shrink-0"
                >
                  <StudentAvatar
                    name={workspace.profile?.fullName || session.fullName}
                    avatarUrl={workspace.profile?.avatarUrl || session.avatarUrl}
                    sizeClass="w-6 h-6 text-[10px]"
                  />
                  <span className="max-w-[110px] truncate">
                    {workspace.profile?.fullName || session.fullName}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-[#6A5ACD]/60 bg-[#2D2B55] px-3.5 py-2 text-xs font-semibold text-[#F0D9B5] hover:bg-[#6A5ACD]/40 hover:border-[#A678B9] transition-colors whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Compact mobile navigation rail for Students ONLY */}
          {!isAdminUser && (
            <nav className="md:hidden border-t border-[#6A5ACD]/30 px-4 py-2 flex items-center gap-4 overflow-x-auto bg-[#1A1A1F]">
              {studentNavItems.map((item) => {
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!item.enabled && !item.lockedByInterview}
                    onClick={() => handleStudentNavClick(item)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 text-xs py-1 border-b-2 transition-colors ${
                      active
                        ? 'border-[#F4A62A] text-[#F4A62A] font-semibold'
                        : item.enabled
                          ? 'border-transparent text-[#D6C7DF]'
                          : 'border-transparent text-[#6A5ACD]/55'
                    }`}
                  >
                    {item.lockedByInterview && <Lock className="w-3 h-3 text-[#F4A62A]/80" />}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </header>
      )}

      {/* Role & Access Policy Notification Banner */}
      {routeNotice && (
        <div className="bg-[#2D2B55] border-b border-[#F4A62A]/45 px-4 py-2.5">
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 text-xs text-[#F0D9B5]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#F4A62A] shrink-0" />
              <span>{routeNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setRouteNotice(null)}
              aria-label="Dismiss notice"
              className="text-[#D6C7DF] hover:text-[#F0D9B5] p-0.5 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Stage */}
      <main className="flex-1">
        {view === 'admin_login' && (!session || session.role !== 'admin') && (
          <div key="view-admin-login" className="animate-stage-enter">
            <AdminLoginView
              onAdminAuthenticated={handleAdminAuthenticated}
              onBackToStudentLogin={() => {
                setRouteNotice(null);
                navigateTo('auth');
              }}
            />
          </div>
        )}

        {(!session || !workspace || view === 'auth') && view !== 'admin_login' && (
          <div key="view-auth" className="animate-stage-enter">
            <AuthOnboarding
              mode="auth"
              initialProfile={workspace?.profile || null}
              onAuthSuccess={handleStudentAuthSuccess}
              onProfileComplete={handleProfileComplete}
              onGoToAdminLogin={() => {
                setRouteNotice(null);
                navigateTo('admin_login');
              }}
            />
          </div>
        )}

        {session && workspace && isAdminUser && view === 'admin' && (
          <div key="view-admin" className="animate-stage-enter">
            <AdminDashboard
              session={session}
              activeSection={adminSection}
              onSectionChange={(section) => navigateTo('admin', section)}
              onSessionPromoted={(updated) => setSession(updated)}
              onCatalogChanged={() => {
                void refreshLiveCatalog();
              }}
            />
          </div>
        )}

        {session && workspace && !isAdminUser && view === 'profile' && (
          <div key="view-profile" className="animate-stage-enter">
            <AuthOnboarding
              mode="profile"
              initialProfile={workspace.profile}
              onAuthSuccess={handleStudentAuthSuccess}
              onProfileComplete={handleProfileComplete}
            />
          </div>
        )}

        {session && workspace && !isAdminUser && view === 'dashboard' && (
          <div key="view-dashboard" className="animate-stage-enter">
            <StudentDashboard
              session={session}
              workspace={workspace}
              catalogCareers={liveCareers}
              interviewCompleted={interviewCompleted}
              onSaveProfile={handleSaveStudentDashboardProfile}
              onNavigate={(target) => {
                if (
                  (target === 'explore' ||
                    target === 'roadmap' ||
                    target === 'world' ||
                    target === 'progress') &&
                  !interviewCompleted
                ) {
                  setRouteNotice(
                    'Complete the AI interview first to unlock career exploration and roadmaps.'
                  );
                  navigateTo('interview');
                  return;
                }
                if (target === 'explore' && workspace.recommendations.length === 0) {
                  void handleGenerateRecommendations();
                } else {
                  navigateTo(target);
                }
              }}
              onSignOut={handleSignOut}
            />
          </div>
        )}

        {session && workspace && !isAdminUser && workspace.profile && view === 'interview' && (
          <div key="view-interview" className="animate-stage-enter">
            <InterviewStudio
              profile={workspace.profile}
              interview={workspace.interview}
              onUpdateInterview={handleUpdateInterview}
              onGenerateRecommendations={handleGenerateRecommendations}
              generatingRecs={busyAction}
            />
          </div>
        )}

        {session && workspace && !isAdminUser && interviewCompleted && view === 'explore' && (
          <div key="view-explore" className="animate-stage-enter">
            <CareerExplorer
              profile={workspace.profile}
              catalogCareers={liveCareers}
              recommendations={workspace.recommendations}
              selectedCareerId={workspace.selectedCareerId}
              compareCareerIds={workspace.compareCareerIds}
              onToggleCompare={handleToggleCompare}
              onSelectCareer={(id) => handleSelectCareer(id, false)}
              onRefreshRecommendations={handleGenerateRecommendations}
              loadingAction={busyAction}
            />
          </div>
        )}

        {session &&
          workspace &&
          !isAdminUser &&
          interviewCompleted &&
          selectedCareer &&
          view === 'roadmap' && (
            <div key="view-roadmap" className="animate-stage-enter">
              <RoadmapView
                career={selectedCareer}
                profile={workspace.profile}
                roadmap={workspace.roadmap}
                completedMissionIds={workspace.completedMissionIds}
                watchedVideoSessionIds={workspace.watchedVideoSessionIds || []}
                missionResults={workspace.missionResults}
                onToggleMilestone={handleToggleMilestone}
                onMarkSessionWatched={handleMarkSessionWatched}
                onLaunchMission={(mission, stage) => setActiveMission({ mission, stage })}
                onEnter3DWorld={(bId) => {
                  setFocusBuildingId(bId || null);
                  navigateTo('world');
                }}
                onExploreAlternatives={() => navigateTo('explore')}
              />
            </div>
          )}

        {session &&
          workspace &&
          !isAdminUser &&
          interviewCompleted &&
          selectedCareer &&
          view === 'world' && (
            <CareerWorld3D
              career={selectedCareer}
              profile={workspace.profile}
              roadmap={workspace.roadmap}
              completedMissionIds={workspace.completedMissionIds}
              watchedVideoSessionIds={workspace.watchedVideoSessionIds || []}
              completed3DActivityIds={workspace.completed3DActivityIds || []}
              missionResults={workspace.missionResults}
              skills={workspace.skills}
              mentorHistory={workspace.mentorHistory}
              initialFocusBuildingId={focusBuildingId}
              onUpdateMentorHistory={handleUpdateMentorHistory}
              onMarkSessionWatched={handleMarkSessionWatched}
              onComplete3DActivity={handleComplete3DActivity}
              onLaunchMission={(mission, stage) => setActiveMission({ mission, stage })}
              onExitToRoadmap={() => navigateTo('roadmap')}
            />
          )}

        {session &&
          workspace &&
          !isAdminUser &&
          interviewCompleted &&
          selectedCareer &&
          view === 'progress' && (
            <div key="view-progress" className="animate-stage-enter">
              <ProgressAndPivot
                studentName={workspace.profile?.fullName || session.fullName}
                career={selectedCareer}
                catalogCareers={liveCareers}
                interview={workspace.interview}
                recommendations={workspace.recommendations}
                roadmap={workspace.roadmap}
                skills={workspace.skills}
                completedMissionIds={workspace.completedMissionIds}
                watchedVideoSessionIds={workspace.watchedVideoSessionIds || []}
                completed3DActivityIds={workspace.completed3DActivityIds || []}
                advancedUnlocked={workspace.advancedUnlocked}
                cachedAnalytics={workspace.progressAnalytics}
                onUpdateAnalytics={handleUpdateAnalytics}
                onSatisfiedContinue={handleSatisfiedContinue}
                onPivotCareer={handlePivotCareer}
                onEnter3DWorld={() => navigateTo('world')}
              />
            </div>
          )}
      </main>

      {/* Interactive Mission & AI Evaluation Modal (Shared between Roadmap & 3D World) */}
      {activeMission && selectedCareer && workspace && !isAdminUser && (
        <MissionModal
          careerId={selectedCareer.id}
          mission={activeMission.mission}
          existingResult={workspace.missionResults[activeMission.mission.id]}
          onClose={() => setActiveMission(null)}
          onMissionEvaluated={handleMissionEvaluated}
        />
      )}
    </div>
  );
}
