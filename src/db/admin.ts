import crypto from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  adminInvitations,
  managedCareers,
  managedEnvironments,
  managedMissions,
  managedRoadmaps,
  platformConfig,
  studentWorkspaces,
  users,
} from './schema.ts';
import { CAREER_CATEGORIES, CAREER_CATALOG, buildDefaultRoadmapForCareer } from '../data/careers.ts';
import type {
  AccountStatus,
  AdminInterviewSettings,
  AdminInvitationRecord,
  AdminOverviewResponse,
  AdminPermission,
  AdminRecommendationSettings,
  AdminStudentRecord,
  AdminSystemIssue,
  ManagedCareerRecord,
  ManagedEnvironmentRecord,
  ManagedMissionRecord,
  ManagedRoadmapRecord,
  UserRole,
} from '../types.ts';

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  'manage_students',
  'manage_careers',
  'manage_ai',
  'manage_worlds',
  'manage_missions',
  'manage_roadmaps',
  'view_analytics',
  'manage_security',
];

const DEFAULT_INTERVIEW_SETTINGS: AdminInterviewSettings = {
  categories: [
    'Analytical & Quantitative Reasoning',
    'Core Subject Application',
    'Collaboration & Leadership',
    'Ethics & Risk Judgment',
    'Systems & Creative Problem Solving',
  ],
  systemInstructions:
    'Ask one focused question at a time grounded in the student academic stage and subjects. Probe brief answers with concise follow-ups to evaluate reasoning depth, communication clarity, and practical trade-off awareness.',
  assessmentCriteria: [
    'Communication clarity, conciseness, and structured reasoning',
    'Conceptual subject depth and real-world example grounding',
    'Composure and decisiveness when defending trade-offs',
    'Non-verbal delivery cues: posture, camera eye contact, and pacing',
  ],
  qualityNotes:
    'Ensure questions remain encouraging for Class 10–12 students while maintaining rigorous analytical depth for college and final-year tracks.',
  questions: [
    {
      id: 'q-analytical-1',
      category: 'Analytical & Quantitative Reasoning',
      difficulty: 'Intermediate',
      prompt: 'Walk through how you diagnose a sudden drop in accuracy or reliability when two variables change simultaneously.',
      rubric: 'Checks isolation of variables, baseline comparison, and metric verification.',
      active: true,
    },
    {
      id: 'q-subject-1',
      category: 'Core Subject Application',
      difficulty: 'Beginner',
      prompt: 'Explain a foundational principle from your favorite school or college subject and how it applies to a real industry problem.',
      rubric: 'Evaluates clarity of explanation and practical transfer outside textbooks.',
      active: true,
    },
    {
      id: 'q-collab-1',
      category: 'Collaboration & Leadership',
      difficulty: 'Intermediate',
      prompt: 'Describe how you resolve a disagreement inside a project team with 48 hours left before submission.',
      rubric: 'Assesses empathy, scope triage, and evidence-backed alignment.',
      active: true,
    },
    {
      id: 'q-ethics-1',
      category: 'Ethics & Risk Judgment',
      difficulty: 'Advanced',
      prompt: 'You spot a subtle edge-case risk right before shipping. How do you weigh schedule pressure against user safety?',
      rubric: 'Evaluates principled risk disclosure and concrete mitigation steps.',
      active: true,
    },
  ],
};

const DEFAULT_RECOMMENDATION_SETTINGS: AdminRecommendationSettings = {
  scoringWeights: {
    abilityMatch: 40,
    interestAlignment: 25,
    academicEligibility: 20,
    growthOutlook: 15,
  },
  explanationTemplate:
    'Matched based on demonstrated reasoning strengths, academic stream alignment, subject proficiency, and long-term growth trajectory.',
  qualityAuditNotes:
    'Monitor recommendations for students in 10th–11th Standard so stream eligibility notes clearly highlight prerequisites before 12th board exams.',
  flaggedSuggestions: [],
};

const DEFAULT_ISSUES: AdminSystemIssue[] = [
  {
    id: 'issue-seed-1',
    area: 'Roadmaps & Eligibility',
    severity: 'low',
    message: 'Verify upcoming national entrance exam application dates and scholarship links before next quarter.',
    status: 'open',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_ENVIRONMENTS: ManagedEnvironmentRecord[] = [
  {
    buildingId: 'building-admissions',
    name: 'Admissions & Exam Pavilion',
    careerId: 'all',
    stageType: 'twelfth',
    themeColor: '#6A5ACD',
    description: 'Interactive foundation plaza for 10th–12th entrance readiness, exam prep schedules, and counselling simulations.',
    interactiveObjects: ['Exam Diagnostic Terminal', 'Counselling Preference Kiosk', 'Scholarship Board'],
    activities: ['Entrance Eligibility Audit', '3-Tier College Shortlisting', 'Exam Cadence Planner'],
    assets: ['pavilion_dome_mesh', 'sign_admissions_canvas', 'beacon_admissions_violet'],
  },
  {
    buildingId: 'building-foundations',
    name: 'Foundations Academic Hall',
    careerId: 'all',
    stageType: 'first_year',
    themeColor: '#A678B9',
    description: 'First-year core studio featuring domain fundamentals, faculty mentoring desks, and modular lab benches.',
    interactiveObjects: ['Modular Lab Workbench', 'Curriculum Reference Wall', 'TA Feedback Console'],
    activities: ['First-Year Core Lab Practical', 'Assumption Documentation Drill'],
    assets: ['foundations_hall_mesh', 'sign_foundations_canvas', 'beacon_orchid'],
  },
  {
    buildingId: 'building-innovation',
    name: 'Innovation & Internship Lab',
    careerId: 'all',
    stageType: 'mid_years',
    themeColor: '#F4A62A',
    description: 'Applied engineering & internship wing simulating realistic team sprints, trade-offs, and prototype telemetry.',
    interactiveObjects: ['Sprint Telemetry Wall', 'Prototype Test Bench', 'Internship Mentor Desk'],
    activities: ['48-Hour Trade-off Challenge', 'Portfolio Capstone Review'],
    assets: ['innovation_lab_mesh', 'sign_innovation_canvas', 'beacon_amber'],
  },
  {
    buildingId: 'building-placement',
    name: 'Placement & Interview Center',
    careerId: 'all',
    stageType: 'final_year',
    themeColor: '#6A5ACD',
    description: 'Executive hiring hub hosting panel interviews, STAR communication evaluations, and job-offer gates.',
    interactiveObjects: ['Panel Interview Pod', 'Portfolio Defense Podium', 'Offer Decision Terminal'],
    activities: ['Final Placement Interview Gate', 'System Design Critique'],
    assets: ['placement_hub_mesh', 'sign_placement_canvas', 'beacon_violet'],
  },
  {
    buildingId: 'building-workplace',
    name: 'Executive Industry Tower',
    careerId: 'all',
    stageType: 'workplace',
    themeColor: '#F4A62A',
    description: 'Sky-deck industry tower for workplace leadership, cross-team roadmaps, and principal specialization sprints.',
    interactiveObjects: ['Strategy War-Room Table', 'Specialization Atlas', 'Mentorship Lounge'],
    activities: ['90-Day Ownership Proposal', 'Principal Architecture Challenge'],
    assets: ['industry_tower_mesh', 'sign_workplace_canvas', 'beacon_gold'],
  },
  {
    buildingId: 'building-mentor',
    name: 'AI Mentor Observatory',
    careerId: 'all',
    stageType: 'twelfth',
    themeColor: '#A678B9',
    description: 'Central campus observatory housing the Vectora voice mentor drone and cross-career guidance terminal.',
    interactiveObjects: ['Voice Mentor Drone', 'Career Analytics Globe', 'Skill Telemetry Display'],
    activities: ['Live Voice Mentoring Session', 'Skill Gap Diagnostic'],
    assets: ['observatory_dome_mesh', 'drone_mentor_bot', 'pond_water_plane'],
  },
];

let seedPromise: Promise<void> | null = null;

export async function ensurePlatformSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        const existingConfig = await db
          .select()
          .from(platformConfig)
          .where(eq(platformConfig.configKey, 'main'))
          .limit(1);

        if (existingConfig.length === 0) {
          await db
            .insert(platformConfig)
            .values({
              configKey: 'main',
              adminPasscodeHash: null,
              interviewSettingsJson: DEFAULT_INTERVIEW_SETTINGS,
              recommendationSettingsJson: DEFAULT_RECOMMENDATION_SETTINGS,
              analyticsReportsJson: DEFAULT_ISSUES,
            })
            .onConflictDoNothing();
        }

        const existingCareers = await db.select({ careerId: managedCareers.careerId }).from(managedCareers);
        const existingCareerIds = new Set(existingCareers.map((c) => c.careerId));
        for (const career of CAREER_CATALOG) {
          if (!existingCareerIds.has(career.id)) {
            await db
              .insert(managedCareers)
              .values({
                careerId: career.id,
                title: career.title,
                domain: career.domain,
                tagline: career.tagline,
                description: career.description,
                accentColor: career.accentColor,
                eligibility12th: career.eligibility12th,
                entranceExamsJson: career.entranceExams,
                recommendedCoursesJson: career.recommendedCourses,
                counsellingNotes: career.counsellingNotes,
                requiredSkillsJson: career.requiredSkills,
                salaryBand: career.salaryBand,
                growthOutlook: career.growthOutlook,
                workplaceRolesJson: career.workplaceRoles,
                specializationsJson: career.specializations,
                dailySimulationContext: career.dailySimulationContext,
                scholarshipsJson: [
                  {
                    id: `${career.id}-sch-1`,
                    institution: 'National Merit & STEM Fellowship',
                    scholarshipName: `${career.domain} Undergraduate Scholarship`,
                    eligibility: career.eligibility12th,
                    deadline: 'Annual · October Cycle',
                    url: 'https://scholarships.gov.in',
                  },
                ],
                externalLinksJson: [
                  {
                    id: `${career.id}-ext-1`,
                    label: `${career.entranceExams[0] || 'Official Entrance'} Portal`,
                    url: 'https://www.education.gov.in',
                  },
                ],
                isActive: true,
              })
              .onConflictDoNothing();
          }
        }

        const existingEnvs = await db.select({ buildingId: managedEnvironments.buildingId }).from(managedEnvironments);
        if (existingEnvs.length === 0) {
          for (const env of DEFAULT_ENVIRONMENTS) {
            await db
              .insert(managedEnvironments)
              .values({
                buildingId: env.buildingId,
                name: env.name,
                careerId: env.careerId,
                stageType: env.stageType,
                themeColor: env.themeColor,
                description: env.description,
                interactiveObjectsJson: env.interactiveObjects,
                activitiesJson: env.activities,
                assetsJson: env.assets,
              })
              .onConflictDoNothing();
          }
        }

        const existingMissions = await db.select({ id: managedMissions.id }).from(managedMissions).limit(1);
        if (existingMissions.length === 0) {
          for (const career of CAREER_CATALOG) {
            const stages = buildDefaultRoadmapForCareer(career, true);
            for (const st of stages) {
              for (const m of st.missions) {
                await db
                  .insert(managedMissions)
                  .values({
                    missionKey: m.id,
                    careerId: career.id,
                    buildingId: st.buildingId,
                    stageType: st.stageType,
                    title: m.title,
                    category: m.category,
                    difficulty: m.isAdvanced ? 'Advanced' : st.stageNumber >= 3 ? 'Intermediate' : 'Beginner',
                    summary: m.summary,
                    scenarioContext: m.scenarioContext,
                    taskPrompt: m.taskPrompt,
                    evaluationCriteriaJson: m.evaluationCriteria,
                    skillRewardsJson: m.skillRewards,
                    qualityRating: 5,
                  })
                  .onConflictDoNothing();
              }
            }
          }
        }

        const existingRoadmaps = await db.select({ id: managedRoadmaps.id }).from(managedRoadmaps).limit(1);
        if (existingRoadmaps.length === 0) {
          for (const career of CAREER_CATALOG) {
            await db
              .insert(managedRoadmaps)
              .values({
                pathwayKey: `${career.id}-entry-pathway`,
                careerId: career.id,
                stageType: 'twelfth',
                title: `${career.title} — Entry & Qualification Pathway`,
                qualificationRequirements: career.eligibility12th,
                coursesJson: career.recommendedCourses,
                entranceExamsJson: career.entranceExams,
                collegesAndScholarshipsJson: [
                  {
                    id: `${career.id}-col-1`,
                    institution: 'Top National & State Accredited Institutes',
                    scholarshipName: 'Merit-cum-Means Tuition Waiver',
                    eligibility: 'Top 10% entrance rank & academic threshold',
                    deadline: 'Counselling Round 1',
                    url: 'https://scholarships.gov.in',
                  },
                ],
                externalLinksJson: [
                  {
                    id: `${career.id}-link-1`,
                    label: 'Ministry of Education Counselling Guidelines',
                    url: 'https://www.education.gov.in',
                  },
                ],
              })
              .onConflictDoNothing();
          }
        }
      } catch (error) {
        seedPromise = null;
        console.error('Platform seed error:', error);
        throw error;
      }
    })();
  }
  await seedPromise;
}

function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyHashedPasscode(passcode: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(passcode, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function timingSafeComparePlain(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function getAdminSecurityStatus() {
  await ensurePlatformSeeded();
  const rows = await db
    .select({ adminPasscodeHash: platformConfig.adminPasscodeHash })
    .from(platformConfig)
    .where(eq(platformConfig.configKey, 'main'))
    .limit(1);

  const hasEnvCode = Boolean(process.env.ADMIN_ACCESS_CODE?.trim());
  const isClaimed = Boolean(rows[0]?.adminPasscodeHash);
  return {
    hasEnvCode,
    isClaimed,
    requiresSetupClaim: false,
  };
}

export async function verifyAdminPortalLogin(
  userId: number,
  email: string,
  currentRole: UserRole,
  currentPermissions: AdminPermission[],
  passcode?: string
): Promise<{
  granted: boolean;
  role: UserRole;
  permissions: AdminPermission[];
  message: string;
}> {
  await ensurePlatformSeeded();
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = (passcode || '').trim();
  const envCode = process.env.ADMIN_ACCESS_CODE?.trim();

  // Case 1: User already holds the ADMIN role in PostgreSQL
  if (currentRole === 'admin') {
    if (envCode && cleanCode) {
      if (!timingSafeComparePlain(cleanCode, envCode)) {
        return {
          granted: false,
          role: 'student',
          permissions: [],
          message: 'Invalid administrator access code.',
        };
      }
    }
    return {
      granted: true,
      role: 'admin',
      permissions: currentPermissions.length ? currentPermissions : ALL_ADMIN_PERMISSIONS,
      message: 'Administrator identity verified.',
    };
  }

  // Case 2: User is a STUDENT — check if they have an explicit server-side Admin Invitation
  const inviteRows = await db
    .select()
    .from(adminInvitations)
    .where(eq(adminInvitations.email, cleanEmail))
    .limit(1);
  const invite = inviteRows[0];

  if (!invite || invite.status !== 'pending') {
    return {
      granted: false,
      role: 'student',
      permissions: [],
      message:
        'Access denied: This account has the STUDENT role. Administrator accounts must be provisioned by an authorized admin.',
    };
  }

  // Invited admin accepting invitation — verify optional env passcode if configured
  const cfgRows = await db
    .select({ adminPasscodeHash: platformConfig.adminPasscodeHash })
    .from(platformConfig)
    .where(eq(platformConfig.configKey, 'main'))
    .limit(1);
  const cfgHash = cfgRows[0]?.adminPasscodeHash;

  if (envCode) {
    if (!cleanCode || !timingSafeComparePlain(cleanCode, envCode)) {
      return {
        granted: false,
        role: 'student',
        permissions: [],
        message: 'Administrator access code required to accept this admin invitation.',
      };
    }
  } else if (cfgHash && cleanCode && !verifyHashedPasscode(cleanCode, cfgHash)) {
    return {
      granted: false,
      role: 'student',
      permissions: [],
      message: 'Invalid administrator passcode.',
    };
  }

  const assignedPermissions: AdminPermission[] =
    invite.permissionsJson?.length ? invite.permissionsJson : ALL_ADMIN_PERMISSIONS;
  const now = new Date();

  await db
    .update(users)
    .set({
      role: 'admin',
      permissionsJson: assignedPermissions,
      lastActiveAt: now,
    })
    .where(eq(users.id, userId));

  await db
    .update(adminInvitations)
    .set({ status: 'accepted', acceptedAt: now })
    .where(eq(adminInvitations.id, invite.id));

  return {
    granted: true,
    role: 'admin',
    permissions: assignedPermissions,
    message: 'Admin invitation verified and administrator role activated.',
  };
}

export async function listAdminInvitations(): Promise<AdminInvitationRecord[]> {
  await ensurePlatformSeeded();
  const rows = await db.select().from(adminInvitations).orderBy(desc(adminInvitations.createdAt));
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    invitedByEmail: r.invitedByEmail,
    permissions: r.permissionsJson || [],
    status: (r.status as AdminInvitationRecord['status']) || 'pending',
    createdAt: r.createdAt.toISOString(),
    acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString() : null,
  }));
}

export async function createAdminInvitation(
  email: string,
  invitedByEmail: string,
  permissions: AdminPermission[]
): Promise<AdminInvitationRecord> {
  await ensurePlatformSeeded();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('A valid email address is required for an admin invitation.');
  }
  const perms: AdminPermission[] = permissions.length ? permissions : ALL_ADMIN_PERMISSIONS;
  const now = new Date();

  // If user already exists in DB, keep pending invitation OR let them activate via /admin/login
  const [saved] = await db
    .insert(adminInvitations)
    .values({
      email: cleanEmail,
      invitedByEmail: invitedByEmail.trim().toLowerCase(),
      permissionsJson: perms,
      status: 'pending',
      createdAt: now,
      acceptedAt: null,
    })
    .onConflictDoUpdate({
      target: adminInvitations.email,
      set: {
        invitedByEmail: invitedByEmail.trim().toLowerCase(),
        permissionsJson: perms,
        status: 'pending',
        acceptedAt: null,
      },
    })
    .returning();

  return {
    id: saved.id,
    email: saved.email,
    invitedByEmail: saved.invitedByEmail,
    permissions: saved.permissionsJson || [],
    status: (saved.status as AdminInvitationRecord['status']) || 'pending',
    createdAt: saved.createdAt.toISOString(),
    acceptedAt: saved.acceptedAt ? saved.acceptedAt.toISOString() : null,
  };
}

export async function revokeAdminInvitation(id: number) {
  await ensurePlatformSeeded();
  await db
    .update(adminInvitations)
    .set({ status: 'revoked' })
    .where(eq(adminInvitations.id, id));
}

export async function updateAdminPasscodeForUser(newPasscode: string) {
  await ensurePlatformSeeded();
  if (newPasscode.trim().length < 6) {
    throw new Error('New admin passcode must be at least 6 characters.');
  }
  const newHash = hashPasscode(newPasscode.trim());
  await db
    .update(platformConfig)
    .set({ adminPasscodeHash: newHash, updatedAt: new Date() })
    .where(eq(platformConfig.configKey, 'main'));
}

export async function listManagedCareers(includeInactive = true): Promise<ManagedCareerRecord[]> {
  await ensurePlatformSeeded();
  const rows = await db.select().from(managedCareers).orderBy(managedCareers.id);
  const mapped: ManagedCareerRecord[] = rows.map((r) => ({
    id: r.careerId,
    title: r.title,
    domain: r.domain,
    tagline: r.tagline,
    description: r.description,
    accentColor: r.accentColor,
    eligibility12th: r.eligibility12th,
    entranceExams: r.entranceExamsJson,
    recommendedCourses: r.recommendedCoursesJson,
    counsellingNotes: r.counsellingNotes,
    requiredSkills: r.requiredSkillsJson,
    salaryBand: r.salaryBand,
    growthOutlook: r.growthOutlook,
    workplaceRoles: r.workplaceRolesJson,
    specializations: r.specializationsJson,
    dailySimulationContext: r.dailySimulationContext,
    scholarships: r.scholarshipsJson,
    externalLinks: r.externalLinksJson,
    isActive: r.isActive,
    updatedAt: r.updatedAt.toISOString(),
  }));
  return includeInactive ? mapped : mapped.filter((c) => c.isActive);
}

export async function upsertManagedCareer(career: ManagedCareerRecord): Promise<ManagedCareerRecord> {
  await ensurePlatformSeeded();
  const cleanId = career.id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '') || `career-${Date.now()}`;
  const now = new Date();

  await db
    .insert(managedCareers)
    .values({
      careerId: cleanId,
      title: career.title.trim(),
      domain: career.domain.trim() || CAREER_CATEGORIES[0],
      tagline: career.tagline.trim(),
      description: career.description.trim(),
      accentColor: career.accentColor || '#F4A62A',
      eligibility12th: career.eligibility12th.trim(),
      entranceExamsJson: career.entranceExams,
      recommendedCoursesJson: career.recommendedCourses,
      counsellingNotes: career.counsellingNotes.trim(),
      requiredSkillsJson: career.requiredSkills,
      salaryBand: career.salaryBand.trim(),
      growthOutlook: career.growthOutlook.trim(),
      workplaceRolesJson: career.workplaceRoles,
      specializationsJson: career.specializations,
      dailySimulationContext: career.dailySimulationContext.trim(),
      scholarshipsJson: career.scholarships || [],
      externalLinksJson: career.externalLinks || [],
      isActive: career.isActive ?? true,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: managedCareers.careerId,
      set: {
        title: career.title.trim(),
        domain: career.domain.trim() || CAREER_CATEGORIES[0],
        tagline: career.tagline.trim(),
        description: career.description.trim(),
        accentColor: career.accentColor || '#F4A62A',
        eligibility12th: career.eligibility12th.trim(),
        entranceExamsJson: career.entranceExams,
        recommendedCoursesJson: career.recommendedCourses,
        counsellingNotes: career.counsellingNotes.trim(),
        requiredSkillsJson: career.requiredSkills,
        salaryBand: career.salaryBand.trim(),
        growthOutlook: career.growthOutlook.trim(),
        workplaceRolesJson: career.workplaceRoles,
        specializationsJson: career.specializations,
        dailySimulationContext: career.dailySimulationContext.trim(),
        scholarshipsJson: career.scholarships || [],
        externalLinksJson: career.externalLinks || [],
        isActive: career.isActive ?? true,
        updatedAt: now,
      },
    });

  return { ...career, id: cleanId, updatedAt: now.toISOString() };
}

export async function deleteManagedCareer(careerId: string) {
  await ensurePlatformSeeded();
  await db.delete(managedCareers).where(eq(managedCareers.careerId, careerId));
}

export async function getPlatformConfigData() {
  await ensurePlatformSeeded();
  const rows = await db
    .select()
    .from(platformConfig)
    .where(eq(platformConfig.configKey, 'main'))
    .limit(1);
  const cfg = rows[0];
  return {
    interviewSettings: cfg.interviewSettingsJson,
    recommendationSettings: cfg.recommendationSettingsJson,
    issues: cfg.analyticsReportsJson,
    updatedAt: cfg.updatedAt.toISOString(),
  };
}

export async function updateInterviewSettings(settings: AdminInterviewSettings) {
  await ensurePlatformSeeded();
  const now = new Date();
  await db
    .update(platformConfig)
    .set({ interviewSettingsJson: settings, updatedAt: now })
    .where(eq(platformConfig.configKey, 'main'));
  return settings;
}

export async function updateRecommendationSettings(settings: AdminRecommendationSettings) {
  await ensurePlatformSeeded();
  const now = new Date();
  await db
    .update(platformConfig)
    .set({ recommendationSettingsJson: settings, updatedAt: now })
    .where(eq(platformConfig.configKey, 'main'));
  return settings;
}

export async function updateSystemIssues(issues: AdminSystemIssue[]) {
  await ensurePlatformSeeded();
  const now = new Date();
  await db
    .update(platformConfig)
    .set({ analyticsReportsJson: issues, updatedAt: now })
    .where(eq(platformConfig.configKey, 'main'));
  return issues;
}

export async function listManagedEnvironments(): Promise<ManagedEnvironmentRecord[]> {
  await ensurePlatformSeeded();
  const rows = await db.select().from(managedEnvironments).orderBy(managedEnvironments.id);
  return rows.map((r) => ({
    buildingId: r.buildingId,
    name: r.name,
    careerId: r.careerId,
    stageType: r.stageType,
    themeColor: r.themeColor,
    description: r.description,
    interactiveObjects: r.interactiveObjectsJson,
    activities: r.activitiesJson,
    assets: r.assetsJson,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function upsertManagedEnvironment(env: ManagedEnvironmentRecord): Promise<ManagedEnvironmentRecord> {
  await ensurePlatformSeeded();
  const cleanId =
    env.buildingId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '') || `building-${Date.now()}`;
  const now = new Date();

  await db
    .insert(managedEnvironments)
    .values({
      buildingId: cleanId,
      name: env.name.trim(),
      careerId: env.careerId || 'all',
      stageType: env.stageType || 'twelfth',
      themeColor: env.themeColor || '#6A5ACD',
      description: env.description.trim(),
      interactiveObjectsJson: env.interactiveObjects,
      activitiesJson: env.activities,
      assetsJson: env.assets,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: managedEnvironments.buildingId,
      set: {
        name: env.name.trim(),
        careerId: env.careerId || 'all',
        stageType: env.stageType || 'twelfth',
        themeColor: env.themeColor || '#6A5ACD',
        description: env.description.trim(),
        interactiveObjectsJson: env.interactiveObjects,
        activitiesJson: env.activities,
        assetsJson: env.assets,
        updatedAt: now,
      },
    });

  return { ...env, buildingId: cleanId, updatedAt: now.toISOString() };
}

export async function deleteManagedEnvironment(buildingId: string) {
  await ensurePlatformSeeded();
  await db.delete(managedEnvironments).where(eq(managedEnvironments.buildingId, buildingId));
}

export async function listManagedMissions(): Promise<ManagedMissionRecord[]> {
  await ensurePlatformSeeded();
  const rows = await db.select().from(managedMissions).orderBy(managedMissions.id);
  return rows.map((r) => ({
    missionKey: r.missionKey,
    careerId: r.careerId,
    buildingId: r.buildingId,
    stageType: r.stageType,
    title: r.title,
    category: r.category,
    difficulty: (r.difficulty as ManagedMissionRecord['difficulty']) || 'Intermediate',
    summary: r.summary,
    scenarioContext: r.scenarioContext,
    taskPrompt: r.taskPrompt,
    evaluationCriteria: r.evaluationCriteriaJson,
    skillRewards: r.skillRewardsJson,
    qualityRating: r.qualityRating,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function upsertManagedMission(mission: ManagedMissionRecord): Promise<ManagedMissionRecord> {
  await ensurePlatformSeeded();
  const cleanKey =
    mission.missionKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '') || `mission-${Date.now()}`;
  const now = new Date();

  await db
    .insert(managedMissions)
    .values({
      missionKey: cleanKey,
      careerId: mission.careerId,
      buildingId: mission.buildingId,
      stageType: mission.stageType,
      title: mission.title.trim(),
      category: mission.category,
      difficulty: mission.difficulty || 'Intermediate',
      summary: mission.summary.trim(),
      scenarioContext: mission.scenarioContext.trim(),
      taskPrompt: mission.taskPrompt.trim(),
      evaluationCriteriaJson: mission.evaluationCriteria,
      skillRewardsJson: mission.skillRewards,
      qualityRating: mission.qualityRating ?? 5,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: managedMissions.missionKey,
      set: {
        careerId: mission.careerId,
        buildingId: mission.buildingId,
        stageType: mission.stageType,
        title: mission.title.trim(),
        category: mission.category,
        difficulty: mission.difficulty || 'Intermediate',
        summary: mission.summary.trim(),
        scenarioContext: mission.scenarioContext.trim(),
        taskPrompt: mission.taskPrompt.trim(),
        evaluationCriteriaJson: mission.evaluationCriteria,
        skillRewardsJson: mission.skillRewards,
        qualityRating: mission.qualityRating ?? 5,
        updatedAt: now,
      },
    });

  return { ...mission, missionKey: cleanKey, updatedAt: now.toISOString() };
}

export async function deleteManagedMission(missionKey: string) {
  await ensurePlatformSeeded();
  await db.delete(managedMissions).where(eq(managedMissions.missionKey, missionKey));
}

export async function listManagedRoadmaps(): Promise<ManagedRoadmapRecord[]> {
  await ensurePlatformSeeded();
  const rows = await db.select().from(managedRoadmaps).orderBy(managedRoadmaps.id);
  return rows.map((r) => ({
    pathwayKey: r.pathwayKey,
    careerId: r.careerId,
    stageType: r.stageType as ManagedRoadmapRecord['stageType'],
    title: r.title,
    qualificationRequirements: r.qualificationRequirements,
    courses: r.coursesJson,
    entranceExams: r.entranceExamsJson,
    collegesAndScholarships: r.collegesAndScholarshipsJson,
    externalLinks: r.externalLinksJson,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function upsertManagedRoadmap(roadmap: ManagedRoadmapRecord): Promise<ManagedRoadmapRecord> {
  await ensurePlatformSeeded();
  const cleanKey =
    roadmap.pathwayKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '') || `pathway-${Date.now()}`;
  const now = new Date();

  await db
    .insert(managedRoadmaps)
    .values({
      pathwayKey: cleanKey,
      careerId: roadmap.careerId,
      stageType: roadmap.stageType,
      title: roadmap.title.trim(),
      qualificationRequirements: roadmap.qualificationRequirements.trim(),
      coursesJson: roadmap.courses,
      entranceExamsJson: roadmap.entranceExams,
      collegesAndScholarshipsJson: roadmap.collegesAndScholarships,
      externalLinksJson: roadmap.externalLinks,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: managedRoadmaps.pathwayKey,
      set: {
        careerId: roadmap.careerId,
        stageType: roadmap.stageType,
        title: roadmap.title.trim(),
        qualificationRequirements: roadmap.qualificationRequirements.trim(),
        coursesJson: roadmap.courses,
        entranceExamsJson: roadmap.entranceExams,
        collegesAndScholarshipsJson: roadmap.collegesAndScholarships,
        externalLinksJson: roadmap.externalLinks,
        updatedAt: now,
      },
    });

  return { ...roadmap, pathwayKey: cleanKey, updatedAt: now.toISOString() };
}

export async function deleteManagedRoadmap(pathwayKey: string) {
  await ensurePlatformSeeded();
  await db.delete(managedRoadmaps).where(eq(managedRoadmaps.pathwayKey, pathwayKey));
}

export async function listStudentsForAdmin(): Promise<AdminStudentRecord[]> {
  await ensurePlatformSeeded();
  const userRows = await db.select().from(users).orderBy(desc(users.lastActiveAt));
  const wsRows = await db.select().from(studentWorkspaces);
  const wsByUserId = new Map(wsRows.map((w) => [w.userId, w]));

  return userRows.map((u) => {
    const ws = wsByUserId.get(u.id);
    return {
      id: u.id,
      uid: u.uid,
      email: u.email,
      fullName: u.fullName,
      role: (u.role as UserRole) || 'student',
      status: (u.status as AccountStatus) || 'active',
      permissions: u.permissionsJson || [],
      avatarUrl: u.avatarUrl || ws?.profileJson?.avatarUrl || null,
      profile: ws?.profileJson || null,
      selectedCareerId: ws?.selectedCareerId || null,
      completedMissionsCount: ws?.completedMissionIdsJson?.length || 0,
      skills: ws?.skillsJson || {},
      createdAt: u.createdAt.toISOString(),
      lastActiveAt: u.lastActiveAt.toISOString(),
    };
  });
}

export async function updateStudentAccountControl(
  targetUserId: number,
  updates: {
    status?: AccountStatus;
    role?: UserRole;
    permissions?: AdminPermission[];
  }
) {
  await ensurePlatformSeeded();
  const setPayload: Partial<typeof users.$inferInsert> = {};
  if (updates.status) setPayload.status = updates.status;
  if (updates.role) setPayload.role = updates.role;
  if (updates.permissions) setPayload.permissionsJson = updates.permissions;

  const updated = await db
    .update(users)
    .set(setPayload)
    .where(eq(users.id, targetUserId))
    .returning();
  return updated[0];
}

export async function getAdminOverviewAnalytics(): Promise<AdminOverviewResponse> {
  await ensurePlatformSeeded();
  const [allUsers, allWorkspaces, allCareers, allMissions, cfgRows] = await Promise.all([
    db.select().from(users).orderBy(desc(users.lastActiveAt)),
    db.select().from(studentWorkspaces),
    db.select().from(managedCareers),
    db.select().from(managedMissions),
    db.select().from(platformConfig).where(eq(platformConfig.configKey, 'main')).limit(1),
  ]);

  const wsByUser = new Map(allWorkspaces.map((w) => [w.userId, w]));
  const careerById = new Map(allCareers.map((c) => [c.careerId, c]));

  const studentUsers = allUsers.filter((u) => u.role === 'student' || wsByUser.has(u.id));
  const activeStudents = studentUsers.filter((u) => u.status === 'active').length;
  const suspendedStudents = studentUsers.filter((u) => u.status === 'suspended').length;

  const categoryCounts = new Map<string, number>();
  for (const cat of CAREER_CATEGORIES) {
    categoryCounts.set(cat, 0);
  }

  const missionCompletions = new Map<string, { title: string; count: number; totalScore: number }>();
  const missionTitleByKey = new Map(allMissions.map((m) => [m.missionKey, m.title]));

  let totalCompletedMissions = 0;
  let interviewsCompleted = 0;
  let roadmapsGenerated = 0;
  let worldsExplored = 0;
  const nowMs = Date.now();
  let activeToday = 0;

  for (const u of allUsers) {
    if (nowMs - u.lastActiveAt.getTime() < 24 * 60 * 60 * 1000) {
      activeToday += 1;
    }
  }

  for (const ws of allWorkspaces) {
    if (ws.interviewJson?.isComplete || ws.interviewJson?.abilityAssessment || ws.interviewJson?.videoInterviewReport) {
      interviewsCompleted += 1;
    }
    if (ws.roadmapJson.length > 0) {
      roadmapsGenerated += 1;
    }
    if (ws.unlockedBuildingIdsJson.length > 2) {
      worldsExplored += 1;
    }

    if (ws.selectedCareerId) {
      const c = careerById.get(ws.selectedCareerId);
      if (c) {
        categoryCounts.set(c.domain, (categoryCounts.get(c.domain) || 0) + 1);
      }
    }
    for (const rec of ws.recommendationsJson.slice(0, 3)) {
      const c = careerById.get(rec.careerId);
      if (c) {
        categoryCounts.set(c.domain, (categoryCounts.get(c.domain) || 0) + 1);
      }
    }

    totalCompletedMissions += ws.completedMissionIdsJson.length;
    for (const mId of ws.completedMissionIdsJson) {
      const res = ws.missionResultsJson[mId];
      const existing = missionCompletions.get(mId) || {
        title: missionTitleByKey.get(mId) || mId,
        count: 0,
        totalScore: 0,
      };
      existing.count += 1;
      existing.totalScore += res?.score ?? 80;
      missionCompletions.set(mId, existing);
    }
  }

  const mostExploredCategories = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const mostCompletedMissions = Array.from(missionCompletions.entries())
    .map(([missionId, info]) => ({
      missionId,
      title: info.title,
      completions: info.count,
      avgScore: info.count > 0 ? Math.round(info.totalScore / info.count) : 0,
    }))
    .sort((a, b) => b.completions - a.completions)
    .slice(0, 6);

  const recentActivity = allUsers.slice(0, 8).map((u) => {
    const ws = wsByUser.get(u.id);
    const c = ws?.selectedCareerId ? careerById.get(ws.selectedCareerId) : undefined;
    return {
      uid: u.uid,
      fullName: ws?.profileJson?.fullName || u.fullName,
      email: u.email,
      careerTitle: c?.title || 'Exploring Careers',
      completedCount: ws?.completedMissionIdsJson?.length || 0,
      lastActiveAt: u.lastActiveAt.toISOString(),
      status: (u.status as AccountStatus) || 'active',
    };
  });

  const avgCompletionRate =
    studentUsers.length > 0 && allMissions.length > 0
      ? Math.min(100, Math.round((totalCompletedMissions / (studentUsers.length * 5)) * 100))
      : 0;

  const issues = cfgRows[0]?.analyticsReportsJson || [];
  const openIssuesCount = issues.filter((i) => i.status === 'open').length;

  return {
    kpis: {
      totalStudents: studentUsers.length,
      activeStudents,
      suspendedStudents,
      totalCareers: allCareers.filter((c) => c.isActive).length,
      totalMissions: allMissions.length,
      totalCompletedMissions,
      avgCompletionRate,
      openIssuesCount,
    },
    mostExploredCategories,
    mostCompletedMissions,
    recentActivity,
    platformUsage: {
      activeToday,
      interviewsCompleted,
      roadmapsGenerated,
      worldsExplored,
    },
    issues,
  };
}
