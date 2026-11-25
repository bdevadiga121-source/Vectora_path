export type AppView =
  | 'auth'
  | 'admin_login'
  | 'dashboard'
  | 'profile'
  | 'interview'
  | 'explore'
  | 'roadmap'
  | 'world'
  | 'progress'
  | 'admin';

export type EducationStage =
  | '10th Standard'
  | '11th Standard'
  | '12th Standard'
  | 'First Year College'
  | 'Second & Third Year'
  | 'Final Year'
  | 'Graduate / Early Career';

export type UserRole = 'student' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'flagged';
export type AdminPermission =
  | 'manage_students'
  | 'manage_careers'
  | 'manage_ai'
  | 'manage_worlds'
  | 'manage_missions'
  | 'manage_roadmaps'
  | 'view_analytics'
  | 'manage_security';

export interface StudentProfile {
  fullName: string;
  email: string;
  avatarUrl?: string;
  classGrade?: string;
  educationStage: EducationStage;
  academicStream: string;
  topSubjects: string[];
  hobbies?: string[];
  preferredActivities?: string[];
  location?: string;
  bio?: string;
  curiosities: string;
  workPreference: string;
  longTermGoal: string;
}

export interface InterviewMessage {
  id: string;
  role: 'ai' | 'student';
  content: string;
  phase?: number;
  phaseLabel?: string;
  timestamp: string;
}

export interface DemonstratedAbility {
  name: string;
  level: number; // 0-100
  evidence: string;
}

export interface VideoInterviewDimension {
  score: number; // 0-100
  feedback: string;
  suggestions: string[];
}

export interface NonVerbalDimension {
  score: number; // 0-100
  observation: string;
  suggestion: string;
}

export interface VideoInterviewReport {
  overallScore: number;
  overallVerdict: string;
  communicationSkills: VideoInterviewDimension;
  subjectKnowledge: VideoInterviewDimension;
  confidence: VideoInterviewDimension;
  responseQuality: VideoInterviewDimension;
  nonVerbalAnalysis: {
    bodyLanguage: NonVerbalDimension;
    eyeContact: NonVerbalDimension;
    facialExpressions: NonVerbalDimension;
    speakingConfidence: NonVerbalDimension;
  };
  followUpEvaluation: string;
  keyStrengths: string[];
  improvementPlan: string[];
  demonstratedAbilities: DemonstratedAbility[];
  interestsSummary: string[];
  strengthsSummary: string[];
  durationSeconds: number;
  cameraAnalyzed: boolean;
  generatedAt: string;
}

export interface AbilityQuestionItem {
  id: string;
  abilityDimension: string;
  context: string;
  question: string;
  options: string[];
  correctOptionIndex?: number;
}

export interface AbilityQuestionAnswer {
  questionId: string;
  selectedOptionIndex: number;
  writtenExplanation: string;
}

export interface AbilityAssessmentReport {
  overallScore: number;
  summary: string;
  questionBreakdown: {
    questionId: string;
    abilityDimension: string;
    score: number;
    feedback: string;
  }[];
  demonstratedAbilities: DemonstratedAbility[];
  interestsSummary: string[];
  strengthsSummary: string[];
  generatedAt: string;
}

export interface InterviewState {
  messages: InterviewMessage[];
  phase: number; // 1 to 5
  phaseLabel: string;
  isComplete: boolean;
  suggestedReplies: string[];
  demonstratedAbilities: DemonstratedAbility[];
  interestsSummary: string[];
  strengthsSummary: string[];
  areasToImprove?: string[];
  aiInterviewSummary?: string;
  skippedQuestions?: string[];
  videoInterviewReport?: VideoInterviewReport | null;
  abilityQuestions?: AbilityQuestionItem[];
  abilityAssessment?: AbilityAssessmentReport | null;
}

export interface CareerDefinition {
  id: string;
  title: string;
  domain: string;
  tagline: string;
  description: string;
  accentColor: string;
  eligibility12th: string;
  entranceExams: string[];
  recommendedCourses: string[];
  counsellingNotes: string;
  requiredSkills: Record<string, number>;
  salaryBand: string;
  growthOutlook: string;
  workplaceRoles: string[];
  specializations: string[];
  dailySimulationContext: string;
}

export interface CareerRecommendation {
  careerId: string;
  rank: number;
  matchScore: number;
  reasons: string[];
  alignmentHighlights: string[];
  keyGapsToBridge: string[];
  pathwaySummary: string;
}

export type StageType =
  | 'after_12th'
  | 'entrance_exams'
  | 'college_journey'
  | 'skills_experience'
  | 'job_opportunities'
  | 'future_scope'
  | 'twelfth'
  | 'first_year'
  | 'mid_years'
  | 'final_year'
  | 'workplace';

export type MissionCategory =
  | 'exam_prep'
  | 'counselling'
  | 'academic'
  | 'project'
  | 'internship'
  | 'placement_interview'
  | 'workplace'
  | 'advanced';

export interface CareerMission {
  id: string;
  stageId: string;
  title: string;
  category: MissionCategory;
  locationLabel: string;
  summary: string;
  scenarioContext: string;
  taskPrompt: string;
  multipleChoiceQuestion?: {
    question: string;
    options: string[];
    correctIndex: number;
  };
  evaluationCriteria: string[];
  hints: string[];
  learningSupport: string;
  skillRewards: Record<string, number>;
  isAdvanced?: boolean;
  isJobOfferGate?: boolean;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  detail: string;
  completed: boolean;
}

export interface RoadmapStage {
  id: string;
  stageNumber: number;
  stageType: StageType;
  title: string;
  subtitle: string;
  buildingId: string;
  buildingName: string;
  environmentName: string;
  unlocked: boolean;
  completed: boolean;
  milestones: RoadmapMilestone[];
  missions: CareerMission[];
}

export interface MissionEvaluationResult {
  missionId: string;
  passed: boolean;
  score: number;
  feedback: string;
  hints: string[];
  learningSupport: string;
  skillDeltas: Record<string, number>;
  jobOfferOutcome?: boolean;
  evaluatedAt: string;
}

export interface MentorMessage {
  id: string;
  role: 'mentor' | 'student';
  content: string;
  buildingContext?: string;
  timestamp: string;
}

export interface ProgressAnalytics {
  strengths: string[];
  skillGaps: string[];
  careerReadinessScore: number;
  requirementComparison: {
    skill: string;
    current: number;
    required: number;
  }[];
  summary: string;
  satisfactionRecommendation: string;
}

export interface StudentWorkspaceState {
  profile: StudentProfile | null;
  interview: InterviewState;
  recommendations: CareerRecommendation[];
  selectedCareerId: string | null;
  compareCareerIds: string[];
  roadmap: RoadmapStage[];
  completedMissionIds: string[];
  missionResults: Record<string, MissionEvaluationResult>;
  skills: Record<string, number>;
  unlockedBuildingIds: string[];
  watchedVideoSessionIds?: string[];
  completed3DActivityIds?: string[];
  mentorHistory: MentorMessage[];
  satisfactionStatus: 'undecided' | 'satisfied' | 'pivoting';
  advancedUnlocked: boolean;
  progressAnalytics: ProgressAnalytics | null;
  updatedAt: string;
}

export interface AuthSession {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  permissions: AdminPermission[];
  avatarUrl?: string | null;
}

export interface CareerVideoSubtitleCue {
  startSec: number;
  endSec: number;
  text: string;
}

export interface CareerVideoCheckpoint {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export type AnimatedSceneVisualMetaphor =
  | 'gateway'
  | 'exams'
  | 'campus'
  | 'workshop'
  | 'office'
  | 'horizon'
  | 'orbit';

export interface AnimatedSceneBeat {
  id: string;
  title: string;
  badge: string;
  headline: string;
  visualMetaphor: AnimatedSceneVisualMetaphor;
  keyPoints: string[];
  statLabel: string;
  statValue: string;
  motionCue: string;
  durationSec: number;
}

export interface AnimatedSceneScript {
  version: number;
  careerTitle: string;
  sessionTitle: string;
  totalDurationSec: number;
  modelUsed: string;
  theme: {
    primaryColor: string;
    accentColor: string;
    backdropStyle: string;
  };
  scenes: AnimatedSceneBeat[];
}

export interface CareerVideoSessionMedia {
  id: number;
  careerId: string;
  sessionKey: string;
  levelNumber: number;
  sessionTitle: string;
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  interactionId: string | null;
  mimeType: string;
  videoDataBase64: string;
  sceneScript?: AnimatedSceneScript | null;
  modelUsed?: string | null;
  narrationScript?: string | null;
  subtitles?: CareerVideoSubtitleCue[];
  checkpoint?: CareerVideoCheckpoint | null;
  audioBase64?: string | null;
  createdAt: string;
}

export interface CareerVideoSessionPlan {
  sessionKey: string;
  levelNumber: number;
  stageLabel: string;
  title: string;
  subtitle: string;
  animationPrompt: string;
  narrationScript: string;
  keyTakeaways: string[];
  subtitles: CareerVideoSubtitleCue[];
  checkpoint: CareerVideoCheckpoint;
  video?: CareerVideoSessionMedia | null;
}

export interface CareerVideoItem {
  id: number;
  careerId: string;
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  interactionId: string | null;
  mimeType: string;
  videoDataBase64: string;
  createdAt: string;
}

export interface ScholarshipResource {
  id: string;
  institution: string;
  scholarshipName: string;
  eligibility: string;
  deadline: string;
  url: string;
}

export interface ExternalLinkItem {
  id: string;
  label: string;
  url: string;
}

export interface ManagedCareerRecord extends CareerDefinition {
  scholarships: ScholarshipResource[];
  externalLinks: ExternalLinkItem[];
  isActive: boolean;
  updatedAt?: string;
}

export interface AdminQuestionItem {
  id: string;
  category: string;
  difficulty: string;
  prompt: string;
  rubric: string;
  active: boolean;
}

export interface AdminInterviewSettings {
  categories: string[];
  systemInstructions: string;
  assessmentCriteria: string[];
  qualityNotes: string;
  questions: AdminQuestionItem[];
}

export interface FlaggedRecommendationItem {
  id: string;
  careerId: string;
  studentEmail?: string;
  reason: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface AdminRecommendationSettings {
  scoringWeights: {
    abilityMatch: number;
    interestAlignment: number;
    academicEligibility: number;
    growthOutlook: number;
  };
  explanationTemplate: string;
  qualityAuditNotes: string;
  flaggedSuggestions: FlaggedRecommendationItem[];
}

export interface ManagedEnvironmentRecord {
  buildingId: string;
  name: string;
  careerId: string;
  stageType: string;
  themeColor: string;
  description: string;
  interactiveObjects: string[];
  activities: string[];
  assets: string[];
  updatedAt?: string;
}

export interface ManagedMissionRecord {
  missionKey: string;
  careerId: string;
  buildingId: string;
  stageType: string;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  summary: string;
  scenarioContext: string;
  taskPrompt: string;
  evaluationCriteria: string[];
  skillRewards: Record<string, number>;
  qualityRating: number;
  updatedAt?: string;
}

export interface ManagedRoadmapRecord {
  pathwayKey: string;
  careerId: string;
  stageType: StageType;
  title: string;
  qualificationRequirements: string;
  courses: string[];
  entranceExams: string[];
  collegesAndScholarships: ScholarshipResource[];
  externalLinks: ExternalLinkItem[];
  updatedAt?: string;
}

export interface AdminSystemIssue {
  id: string;
  area: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface AdminStudentRecord {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  permissions: AdminPermission[];
  avatarUrl: string | null;
  profile: StudentProfile | null;
  selectedCareerId: string | null;
  completedMissionsCount: number;
  skills: Record<string, number>;
  createdAt: string;
  lastActiveAt: string;
}

export interface AdminOverviewResponse {
  kpis: {
    totalStudents: number;
    activeStudents: number;
    suspendedStudents: number;
    totalCareers: number;
    totalMissions: number;
    totalCompletedMissions: number;
    avgCompletionRate: number;
    openIssuesCount: number;
  };
  mostExploredCategories: { category: string; count: number }[];
  mostCompletedMissions: {
    missionId: string;
    title: string;
    completions: number;
    avgScore: number;
  }[];
  recentActivity: {
    uid: string;
    fullName: string;
    email: string;
    careerTitle: string;
    completedCount: number;
    lastActiveAt: string;
    status: AccountStatus;
  }[];
  platformUsage: {
    activeToday: number;
    interviewsCompleted: number;
    roadmapsGenerated: number;
    worldsExplored: number;
  };
  issues: AdminSystemIssue[];
}

export interface AdminInvitationRecord {
  id: number;
  email: string;
  invitedByEmail: string;
  permissions: AdminPermission[];
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  acceptedAt: string | null;
}
