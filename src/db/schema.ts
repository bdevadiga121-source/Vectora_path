import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type {
  AdminInterviewSettings,
  AdminPermission,
  AdminRecommendationSettings,
  AdminSystemIssue,
  CareerRecommendation,
  CareerVideoCheckpoint,
  CareerVideoSubtitleCue,
  ExternalLinkItem,
  InterviewState,
  MentorMessage,
  MissionEvaluationResult,
  ProgressAnalytics,
  RoadmapStage,
  ScholarshipResource,
  StudentProfile,
} from '../types.ts';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').default('student').notNull(),
  status: text('status').default('active').notNull(),
  permissionsJson: jsonb('permissions_json')
    .$type<AdminPermission[]>()
    .default([])
    .notNull(),
  avatarUrl: text('avatar_url'),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const studentWorkspaces = pgTable('student_workspaces', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  profileJson: jsonb('profile_json').$type<StudentProfile | null>(),
  interviewJson: jsonb('interview_json').$type<InterviewState>().notNull(),
  recommendationsJson: jsonb('recommendations_json').$type<CareerRecommendation[]>().notNull(),
  selectedCareerId: text('selected_career_id'),
  compareCareerIdsJson: jsonb('compare_career_ids_json').$type<string[]>().notNull(),
  roadmapJson: jsonb('roadmap_json').$type<RoadmapStage[]>().notNull(),
  completedMissionIdsJson: jsonb('completed_mission_ids_json').$type<string[]>().notNull(),
  missionResultsJson: jsonb('mission_results_json')
    .$type<Record<string, MissionEvaluationResult>>()
    .notNull(),
  skillsJson: jsonb('skills_json').$type<Record<string, number>>().notNull(),
  unlockedBuildingIdsJson: jsonb('unlocked_building_ids_json').$type<string[]>().notNull(),
  watchedVideoSessionIdsJson: jsonb('watched_video_session_ids_json')
    .$type<string[]>()
    .default([])
    .notNull(),
  completed3DActivityIdsJson: jsonb('completed_3d_activity_ids_json')
    .$type<string[]>()
    .default([])
    .notNull(),
  mentorHistoryJson: jsonb('mentor_history_json').$type<MentorMessage[]>().notNull(),
  satisfactionStatus: text('satisfaction_status').default('undecided').notNull(),
  advancedUnlocked: boolean('advanced_unlocked').default(false).notNull(),
  progressAnalyticsJson: jsonb('progress_analytics_json').$type<ProgressAnalytics | null>(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const careerVideos = pgTable('career_videos', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  careerId: text('career_id').notNull(),
  sessionKey: text('session_key'),
  levelNumber: integer('level_number'),
  sessionTitle: text('session_title'),
  prompt: text('prompt').notNull(),
  aspectRatio: text('aspect_ratio').notNull(),
  interactionId: text('interaction_id'),
  mimeType: text('mime_type').notNull(),
  videoDataBase64: text('video_data_base64').notNull(),
  narrationScript: text('narration_script'),
  subtitlesJson: jsonb('subtitles_json').$type<CareerVideoSubtitleCue[]>().default([]).notNull(),
  checkpointJson: jsonb('checkpoint_json').$type<CareerVideoCheckpoint | null>(),
  audioBase64: text('audio_base64'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const platformConfig = pgTable('platform_config', {
  id: serial('id').primaryKey(),
  configKey: text('config_key').notNull().unique(),
  adminPasscodeHash: text('admin_passcode_hash'),
  interviewSettingsJson: jsonb('interview_settings_json').$type<AdminInterviewSettings>().notNull(),
  recommendationSettingsJson: jsonb('recommendation_settings_json')
    .$type<AdminRecommendationSettings>()
    .notNull(),
  analyticsReportsJson: jsonb('analytics_reports_json').$type<AdminSystemIssue[]>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const managedCareers = pgTable('managed_careers', {
  id: serial('id').primaryKey(),
  careerId: text('career_id').notNull().unique(),
  title: text('title').notNull(),
  domain: text('domain').notNull(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull(),
  accentColor: text('accent_color').notNull(),
  eligibility12th: text('eligibility_12th').notNull(),
  entranceExamsJson: jsonb('entrance_exams_json').$type<string[]>().notNull(),
  recommendedCoursesJson: jsonb('recommended_courses_json').$type<string[]>().notNull(),
  counsellingNotes: text('counselling_notes').notNull(),
  requiredSkillsJson: jsonb('required_skills_json').$type<Record<string, number>>().notNull(),
  salaryBand: text('salary_band').notNull(),
  growthOutlook: text('growth_outlook').notNull(),
  workplaceRolesJson: jsonb('workplace_roles_json').$type<string[]>().notNull(),
  specializationsJson: jsonb('specializations_json').$type<string[]>().notNull(),
  dailySimulationContext: text('daily_simulation_context').notNull(),
  scholarshipsJson: jsonb('scholarships_json').$type<ScholarshipResource[]>().default([]).notNull(),
  externalLinksJson: jsonb('external_links_json').$type<ExternalLinkItem[]>().default([]).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const managedEnvironments = pgTable('managed_environments', {
  id: serial('id').primaryKey(),
  buildingId: text('building_id').notNull().unique(),
  name: text('name').notNull(),
  careerId: text('career_id').notNull(),
  stageType: text('stage_type').notNull(),
  themeColor: text('theme_color').notNull(),
  description: text('description').notNull(),
  interactiveObjectsJson: jsonb('interactive_objects_json').$type<string[]>().notNull(),
  activitiesJson: jsonb('activities_json').$type<string[]>().notNull(),
  assetsJson: jsonb('assets_json').$type<string[]>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const managedMissions = pgTable('managed_missions', {
  id: serial('id').primaryKey(),
  missionKey: text('mission_key').notNull().unique(),
  careerId: text('career_id').notNull(),
  buildingId: text('building_id').notNull(),
  stageType: text('stage_type').notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  difficulty: text('difficulty').default('Intermediate').notNull(),
  summary: text('summary').notNull(),
  scenarioContext: text('scenario_context').notNull(),
  taskPrompt: text('task_prompt').notNull(),
  evaluationCriteriaJson: jsonb('evaluation_criteria_json').$type<string[]>().notNull(),
  skillRewardsJson: jsonb('skill_rewards_json').$type<Record<string, number>>().notNull(),
  qualityRating: integer('quality_rating').default(5).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const managedRoadmaps = pgTable('managed_roadmaps', {
  id: serial('id').primaryKey(),
  pathwayKey: text('pathway_key').notNull().unique(),
  careerId: text('career_id').notNull(),
  stageType: text('stage_type').notNull(),
  title: text('title').notNull(),
  qualificationRequirements: text('qualification_requirements').notNull(),
  coursesJson: jsonb('courses_json').$type<string[]>().notNull(),
  entranceExamsJson: jsonb('entrance_exams_json').$type<string[]>().notNull(),
  collegesAndScholarshipsJson: jsonb('colleges_and_scholarships_json')
    .$type<ScholarshipResource[]>()
    .notNull(),
  externalLinksJson: jsonb('external_links_json').$type<ExternalLinkItem[]>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const adminInvitations = pgTable('admin_invitations', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  invitedByEmail: text('invited_by_email').notNull(),
  permissionsJson: jsonb('permissions_json')
    .$type<AdminPermission[]>()
    .default([])
    .notNull(),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  workspace: one(studentWorkspaces, {
    fields: [users.id],
    references: [studentWorkspaces.userId],
  }),
  videos: many(careerVideos),
}));

export const studentWorkspacesRelations = relations(studentWorkspaces, ({ one }) => ({
  user: one(users, {
    fields: [studentWorkspaces.userId],
    references: [users.id],
  }),
}));

export const careerVideosRelations = relations(careerVideos, ({ one }) => ({
  user: one(users, {
    fields: [careerVideos.userId],
    references: [users.id],
  }),
}));
