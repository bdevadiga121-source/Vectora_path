import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import type {
  AuthSession,
  CareerDefinition,
  CareerMission,
  CareerRecommendation,
  CareerVideoCheckpoint,
  CareerVideoItem,
  CareerVideoSessionMedia,
  CareerVideoSessionPlan,
  CareerVideoSubtitleCue,
  InterviewState,
  MissionEvaluationResult,
  ProgressAnalytics,
  RoadmapStage,
  StudentProfile,
  StudentWorkspaceState,
} from '../types';

// In-memory ID token store (never localStorage)
let inMemoryToken: string | null = null;
let adminAuthInProgress = false;

export function isAdminAuthInProgress(): boolean {
  return adminAuthInProgress;
}

export function setInMemoryToken(token: string | null) {
  inMemoryToken = token;
}

export async function getActiveIdToken(): Promise<string | null> {
  if (auth.currentUser) {
    const fresh = await auth.currentUser.getIdToken();
    inMemoryToken = fresh;
    return fresh;
  }
  return inMemoryToken;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  retryAfterSeconds?: number;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getActiveIdToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallbackMessage =
      res.status === 429
        ? 'Gemini Free Tier rate limit reached. Please wait a few seconds before trying again.'
        : `Request failed (${res.status})`;
    const err = new Error(data.error || fallbackMessage) as ApiError;
    err.status = res.status;
    err.code = typeof data.code === 'string' ? data.code : res.status === 429 ? 'RATE_LIMIT' : undefined;
    err.retryAfterSeconds =
      typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : undefined;
    throw err;
  }
  return data as T;
}

export function formatAuthError(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled on this project yet. Please use Continue with Google.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in window was closed before completing.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment before trying again.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
  }
}

export async function signInWithGooglePopup() {
  const credential = await signInWithPopup(auth, googleAuthProvider);
  const idToken = await credential.user.getIdToken();
  setInMemoryToken(idToken);
  return fetchWorkspaceState();
}

export async function signInWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const idToken = await credential.user.getIdToken();
  setInMemoryToken(idToken);
  return fetchWorkspaceState();
}

export async function signUpWithEmail(fullName: string, email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (fullName.trim()) {
    await updateProfile(credential.user, { displayName: fullName.trim() });
  }
  const idToken = await credential.user.getIdToken(true);
  setInMemoryToken(idToken);
  return fetchWorkspaceState();
}

export async function resetPasswordEmail(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutFirebase() {
  journeyPlanCache.clear();
  journeyPlanInFlight.clear();
  journeyVideoSessionCache.clear();
  journeyVideoSessionInFlight.clear();
  setInMemoryToken(null);
  await signOut(auth);
}

export async function signInAsAdminWithEmail(email: string, password: string, passcode?: string) {
  adminAuthInProgress = true;
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const idToken = await credential.user.getIdToken();
    setInMemoryToken(idToken);
    try {
      return await apiFetch<{ user: AuthSession; message: string }>('/api/auth/admin-verify', {
        method: 'POST',
        body: JSON.stringify({ passcode }),
      });
    } catch (err) {
      // Reject unauthorized student accounts cleanly without leaving an active session
      setInMemoryToken(null);
      await signOut(auth).catch(() => undefined);
      throw err;
    }
  } finally {
    adminAuthInProgress = false;
  }
}

export async function signInAsAdminWithGoogle(passcode?: string) {
  adminAuthInProgress = true;
  try {
    const credential = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await credential.user.getIdToken();
    setInMemoryToken(idToken);
    try {
      return await apiFetch<{ user: AuthSession; message: string }>('/api/auth/admin-verify', {
        method: 'POST',
        body: JSON.stringify({ passcode }),
      });
    } catch (err) {
      setInMemoryToken(null);
      await signOut(auth).catch(() => undefined);
      throw err;
    }
  } finally {
    adminAuthInProgress = false;
  }
}

export async function fetchWorkspaceState() {
  return apiFetch<{ user: AuthSession; workspace: StudentWorkspaceState }>('/api/state');
}

export async function saveWorkspaceState(workspace: StudentWorkspaceState) {
  return apiFetch<{ workspace: StudentWorkspaceState }>('/api/state', {
    method: 'PUT',
    body: JSON.stringify({ workspace }),
  });
}

export async function stepAiInterview(payload: {
  profile: StudentProfile;
  messages: { role: 'ai' | 'student'; content: string }[];
  studentReply?: string;
  startFresh?: boolean;
}) {
  return apiFetch<{
    reply: string;
    phase: number;
    phaseLabel: string;
    isComplete: boolean;
    suggestedReplies: string[];
    interestsSummary: string[];
    strengthsSummary: string[];
    demonstratedAbilities: InterviewState['demonstratedAbilities'];
  }>('/api/ai/interview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchCareerRecommendations(profile: StudentProfile, interview: InterviewState) {
  return apiFetch<{ recommendations: CareerRecommendation[] }>('/api/ai/recommend-careers', {
    method: 'POST',
    body: JSON.stringify({ profile, interview }),
  });
}

export async function generateCareerRoadmap(
  careerId: string,
  profile: StudentProfile,
  advancedUnlocked = false
) {
  return apiFetch<{ roadmap: RoadmapStage[] }>('/api/ai/roadmap', {
    method: 'POST',
    body: JSON.stringify({ careerId, profile, advancedUnlocked }),
  });
}

export async function evaluateMissionSubmission(payload: {
  careerId: string;
  mission: CareerMission;
  selectedOptionIndex: number | null;
  writtenResponse: string;
}) {
  return apiFetch<MissionEvaluationResult>('/api/ai/evaluate-mission', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function askCareerMentor(payload: {
  careerId: string;
  buildingName: string;
  activeMissionTitle?: string;
  question: string;
  skills: Record<string, number>;
}) {
  return apiFetch<{ reply: string }>('/api/ai/mentor', {
    method: 'POST',
    body: JSON.stringify({ ...payload }),
  });
}

export async function analyzeStudentProgress(payload: {
  careerId: string;
  skills: Record<string, number>;
  completedMissionIds: string[];
  roadmap: RoadmapStage[];
}) {
  return apiFetch<{ analytics: ProgressAnalytics }>('/api/ai/analyze-progress', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchCareerVideos() {
  return apiFetch<{ videos: CareerVideoItem[] }>('/api/videos');
}

export async function generateCareerVideo(payload: {
  careerId: string;
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  previousInteractionId?: string;
  imageBase64?: string;
  imageMimeType?: string;
}) {
  return apiFetch<{ video: CareerVideoItem }>('/api/ai/generate-video', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function askExploreMentor(payload: {
  question: string;
  profile?: StudentProfile | null;
  comparedCareerIds?: string[];
  focusedCareerId?: string | null;
}) {
  return apiFetch<{ reply: string }>('/api/ai/explore-mentor', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

const journeyPlanCache = new Map<
  string,
  { career: CareerDefinition; sessions: CareerVideoSessionPlan[] }
>();
const journeyPlanInFlight = new Map<
  string,
  Promise<{ career: CareerDefinition; sessions: CareerVideoSessionPlan[] }>
>();
const journeyVideoSessionCache = new Map<
  string,
  { cached: boolean; video: CareerVideoSessionMedia }
>();
const journeyVideoSessionInFlight = new Map<
  string,
  Promise<{ cached: boolean; video: CareerVideoSessionMedia }>
>();

export async function fetchCareerJourneyPlan(careerId: string, profile?: StudentProfile | null) {
  const cacheKey = `${careerId}:${profile?.educationStage || ''}:${profile?.academicStream || ''}`;
  const cachedPlan = journeyPlanCache.get(cacheKey);
  if (cachedPlan) {
    return cachedPlan;
  }
  const existingPromise = journeyPlanInFlight.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const reqPromise = apiFetch<{ career: CareerDefinition; sessions: CareerVideoSessionPlan[] }>(
    '/api/ai/career-journey-plan',
    {
      method: 'POST',
      body: JSON.stringify({ careerId, profile }),
    }
  )
    .then((res) => {
      journeyPlanCache.set(cacheKey, res);
      // Seed per-session cache if server already returned cached sessions
      for (const s of res.sessions || []) {
        if (s.video) {
          journeyVideoSessionCache.set(`${careerId}:${s.sessionKey}`, {
            cached: true,
            video: s.video,
          });
        }
      }
      return res;
    })
    .finally(() => {
      journeyPlanInFlight.delete(cacheKey);
    });

  journeyPlanInFlight.set(cacheKey, reqPromise);
  return reqPromise;
}

export async function generateCareerJourneyVideoSession(payload: {
  careerId: string;
  sessionKey: string;
  levelNumber: number;
  sessionTitle: string;
  animationPrompt: string;
  narrationScript: string;
  subtitles?: CareerVideoSubtitleCue[];
  checkpoint?: CareerVideoCheckpoint | null;
  forceRegenerate?: boolean;
}) {
  const cacheKey = `${payload.careerId}:${payload.sessionKey}`;
  if (!payload.forceRegenerate) {
    const cached = journeyVideoSessionCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }
  const existingPromise = journeyVideoSessionInFlight.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const reqPromise = apiFetch<{ cached: boolean; video: CareerVideoSessionMedia }>(
    '/api/ai/career-journey-video',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
    .then((res) => {
      journeyVideoSessionCache.set(cacheKey, res);
      // Update any matching plan cache entries so future mounts have the generated scene immediately
      for (const [k, plan] of journeyPlanCache.entries()) {
        if (k.startsWith(`${payload.careerId}:`)) {
          plan.sessions = plan.sessions.map((s) =>
            s.sessionKey === payload.sessionKey ? { ...s, video: res.video } : s
          );
        }
      }
      return res;
    })
    .finally(() => {
      journeyVideoSessionInFlight.delete(cacheKey);
    });

  journeyVideoSessionInFlight.set(cacheKey, reqPromise);
  return reqPromise;
}

export async function evaluateVideoInterview(payload: {
  profile: StudentProfile;
  transcript: { speaker: 'AI' | 'Student'; text: string }[];
  videoFrames: string[];
  durationSeconds: number;
  cameraEnabled: boolean;
}) {
  return apiFetch<{
    report: import('../types').VideoInterviewReport;
  }>('/api/ai/evaluate-video-interview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateAbilityQuestions(profile: StudentProfile) {
  return apiFetch<{
    questions: import('../types').AbilityQuestionItem[];
  }>('/api/ai/ability-questions', {
    method: 'POST',
    body: JSON.stringify({ profile }),
  });
}

export async function evaluateAbilityQuestions(payload: {
  profile: StudentProfile;
  questions: import('../types').AbilityQuestionItem[];
  answers: import('../types').AbilityQuestionAnswer[];
}) {
  return apiFetch<{
    assessment: import('../types').AbilityAssessmentReport;
  }>('/api/ai/evaluate-ability-questions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// --- LIVE CATALOG & ADMIN CONSOLE API ---
export async function fetchLiveCatalog() {
  return apiFetch<{
    careers: import('../types').ManagedCareerRecord[];
    environments: import('../types').ManagedEnvironmentRecord[];
    roadmaps: import('../types').ManagedRoadmapRecord[];
  }>('/api/catalog');
}

export async function fetchAdminSecurityStatus() {
  return apiFetch<{
    hasEnvCode: boolean;
    isClaimed: boolean;
    requiresSetupClaim: boolean;
    isAdmin: boolean;
    permissions: import('../types').AdminPermission[];
  }>('/api/admin/security-status');
}

export async function fetchAdminInvitations() {
  return apiFetch<{ invitations: import('../types').AdminInvitationRecord[] }>(
    '/api/admin/invitations'
  );
}

export async function createAdminInvitation(payload: {
  email: string;
  permissions: import('../types').AdminPermission[];
}) {
  return apiFetch<{ invitation: import('../types').AdminInvitationRecord }>(
    '/api/admin/invitations',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function revokeAdminInvitation(id: number) {
  return apiFetch<{ ok: boolean }>(`/api/admin/invitations/${id}`, {
    method: 'DELETE',
  });
}

export async function updateAdminAccount(payload: {
  fullName?: string;
  avatarUrl?: string;
  newAdminPasscode?: string;
}) {
  return apiFetch<{ ok: boolean }>('/api/admin/account', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminOverview() {
  return apiFetch<import('../types').AdminOverviewResponse>('/api/admin/overview');
}

export async function createAdminIssue(payload: {
  area: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
}) {
  return apiFetch<{ issues: import('../types').AdminSystemIssue[] }>('/api/admin/issues', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminIssueStatus(id: string, status: 'open' | 'resolved') {
  return apiFetch<{ issues: import('../types').AdminSystemIssue[] }>(`/api/admin/issues/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function fetchAdminStudents() {
  return apiFetch<{ students: import('../types').AdminStudentRecord[] }>('/api/admin/students');
}

export async function updateAdminStudent(
  id: number,
  payload: {
    status?: import('../types').AccountStatus;
    role?: import('../types').UserRole;
    permissions?: import('../types').AdminPermission[];
  }
) {
  return apiFetch<{ student: import('../types').AdminStudentRecord }>(`/api/admin/students/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminCareers() {
  return apiFetch<{ careers: import('../types').ManagedCareerRecord[] }>('/api/admin/careers');
}

export async function saveAdminCareer(career: import('../types').ManagedCareerRecord) {
  return apiFetch<{ career: import('../types').ManagedCareerRecord }>('/api/admin/careers', {
    method: 'POST',
    body: JSON.stringify(career),
  });
}

export async function removeAdminCareer(careerId: string) {
  return apiFetch<{ ok: boolean }>(`/api/admin/careers/${encodeURIComponent(careerId)}`, {
    method: 'DELETE',
  });
}

export async function fetchAdminAiConfig() {
  return apiFetch<{
    interviewSettings: import('../types').AdminInterviewSettings;
    recommendationSettings: import('../types').AdminRecommendationSettings;
    issues: import('../types').AdminSystemIssue[];
    updatedAt: string;
  }>('/api/admin/ai-config');
}

export async function saveAdminInterviewConfig(
  settings: import('../types').AdminInterviewSettings
) {
  return apiFetch<{ interviewSettings: import('../types').AdminInterviewSettings }>(
    '/api/admin/interview-config',
    {
      method: 'PUT',
      body: JSON.stringify(settings),
    }
  );
}

export async function saveAdminRecommendationConfig(
  settings: import('../types').AdminRecommendationSettings
) {
  return apiFetch<{ recommendationSettings: import('../types').AdminRecommendationSettings }>(
    '/api/admin/recommendation-config',
    {
      method: 'PUT',
      body: JSON.stringify(settings),
    }
  );
}

export async function fetchAdminEnvironments() {
  return apiFetch<{ environments: import('../types').ManagedEnvironmentRecord[] }>(
    '/api/admin/environments'
  );
}

export async function saveAdminEnvironment(env: import('../types').ManagedEnvironmentRecord) {
  return apiFetch<{ environment: import('../types').ManagedEnvironmentRecord }>(
    '/api/admin/environments',
    {
      method: 'POST',
      body: JSON.stringify(env),
    }
  );
}

export async function removeAdminEnvironment(buildingId: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/admin/environments/${encodeURIComponent(buildingId)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function fetchAdminMissions() {
  return apiFetch<{ missions: import('../types').ManagedMissionRecord[] }>('/api/admin/missions');
}

export async function saveAdminMission(mission: import('../types').ManagedMissionRecord) {
  return apiFetch<{ mission: import('../types').ManagedMissionRecord }>('/api/admin/missions', {
    method: 'POST',
    body: JSON.stringify(mission),
  });
}

export async function removeAdminMission(missionKey: string) {
  return apiFetch<{ ok: boolean }>(`/api/admin/missions/${encodeURIComponent(missionKey)}`, {
    method: 'DELETE',
  });
}

export async function fetchAdminRoadmaps() {
  return apiFetch<{ roadmaps: import('../types').ManagedRoadmapRecord[] }>('/api/admin/roadmaps');
}

export async function saveAdminRoadmap(roadmap: import('../types').ManagedRoadmapRecord) {
  return apiFetch<{ roadmap: import('../types').ManagedRoadmapRecord }>('/api/admin/roadmaps', {
    method: 'POST',
    body: JSON.stringify(roadmap),
  });
}

export async function removeAdminRoadmap(pathwayKey: string) {
  return apiFetch<{ ok: boolean }>(`/api/admin/roadmaps/${encodeURIComponent(pathwayKey)}`, {
    method: 'DELETE',
  });
}

