import { CareerDefinition, CareerMission, RoadmapStage } from '../types';

export const CAREER_CATEGORIES = [
  'Technology and Engineering',
  'Medical and Healthcare',
  'Commerce and Business',
  'Arts, Design and Media',
  'Education and Research',
  'Government, Law and Public Services',
  'Agriculture and Environment',
  'Aviation, Hospitality',
] as const;

export const CAREER_CATALOG: CareerDefinition[] = [
  {
    id: 'ai-systems-engineer',
    title: 'AI & Machine Learning Systems Engineer',
    domain: 'Technology and Engineering',
    tagline: 'Design scalable neural architectures, data pipelines, and real-world autonomous tools.',
    description:
      'Combines mathematical modeling, distributed software systems, and iterative experimentation to build intelligent products from prototype to production.',
    accentColor: '#1d4ed8',
    eligibility12th: 'Physics, Chemistry, Mathematics (PCM) with strong analytical problem solving (minimum 75% aggregate recommended).',
    entranceExams: ['JEE Main & Advanced', 'BITSAT', 'UGEE / State Engineering CETs', 'SAT + Subject Tests (Global)'],
    recommendedCourses: ['B.Tech / B.E. in Computer Science & AI', 'B.S. in Data Science & Engineering', 'Integrated M.Tech in Computational Intelligence'],
    counsellingNotes: 'Prioritize JoSAA, JAC Delhi, or institute counselling rounds based on rank, lab infrastructure, and undergraduate research credits.',
    requiredSkills: {
      'Analytical Reasoning': 85,
      'Systems Architecture': 82,
      'Applied Mathematics': 80,
      'Communication': 70,
      'Execution & Delivery': 78,
    },
    salaryBand: '$95k – $185k / ₹14L – ₹42L early-to-mid career',
    growthOutlook: '+34% projected 10-year demand',
    workplaceRoles: ['ML Infrastructure Engineer', 'Applied AI Scientist', 'LLM Systems Architect'],
    specializations: ['Multimodal Foundation Models', 'Edge & Robotics Inference', 'AI Safety & Evaluation'],
    dailySimulationContext: 'Latency debugging, dataset curation, model evaluation trade-offs, and cross-functional design reviews.',
  },
  {
    id: 'biomedical-architect',
    title: 'Biomedical & Clinical Biotech Engineer',
    domain: 'Medical and Healthcare',
    tagline: 'Bridge molecular biology and precision instrumentation to create life-saving diagnostics.',
    description:
      'Applies engineering rigor to medical imaging, prosthetics, genomic diagnostics, and clinical-grade biotech devices.',
    accentColor: '#0f766e',
    eligibility12th: 'Physics, Chemistry, Biology and/or Mathematics (PCB or PCMB) with laboratory aptitude.',
    entranceExams: ['NEET-UG (Medical/Allied)', 'JEE Main (Bioengineering)', 'IAT (IISER Aptitude Test)', 'GATE / GRE (Postgrad)'],
    recommendedCourses: ['B.Tech in Biomedical Engineering', 'B.S. in Biological Sciences & Bioengineering', 'B.E. in Biotechnology & Medical Devices'],
    counsellingNotes: 'Evaluate medical-college-affiliated engineering institutes and clinical hospital rotation partnerships during counselling.',
    requiredSkills: {
      'Analytical Reasoning': 82,
      'Systems Architecture': 72,
      'Applied Mathematics': 74,
      'Communication': 80,
      'Execution & Delivery': 84,
    },
    salaryBand: '$78k – $145k / ₹9L – ₹28L early-to-mid career',
    growthOutlook: '+21% projected 10-year demand',
    workplaceRoles: ['Clinical Device Engineer', 'Bioinformatics Lead', 'Diagnostic Systems Designer'],
    specializations: ['Neural Prosthetics', 'Point-of-Care Diagnostics', 'Computational Genomics'],
    dailySimulationContext: 'FDA/CDSCO compliance validation, sensor calibration, clinical trials review, and clinician interviews.',
  },
  {
    id: 'product-architect',
    title: 'Human-Centered Product & Spatial Designer',
    domain: 'Arts, Design and Media',
    tagline: 'Shape intuitive software ecosystems, physical hardware ergonomics, and spatial experiences.',
    description:
      'Unites cognitive psychology, visual systems, rapid prototyping, and user research to craft memorable products people rely on daily.',
    accentColor: '#b45309',
    eligibility12th: 'Any academic stream (Science, Commerce, or Humanities) with visual synthesis and creative portfolio aptitude.',
    entranceExams: ['UCEED (IIT Design)', 'NID DAT', 'NATA (Spatial/Architecture)', 'Portfolio & Studio Review'],
    recommendedCourses: ['B.Des in Interaction & Product Design', 'B.Arch / Spatial Computing Design', 'B.S. in Human-Computer Interaction'],
    counsellingNotes: 'Participate in UCEED/NID seat allocation rounds; inspect studio fabrication labs and industry capstone tracks.',
    requiredSkills: {
      'Analytical Reasoning': 74,
      'Systems Architecture': 76,
      'Applied Mathematics': 60,
      'Communication': 90,
      'Execution & Delivery': 82,
    },
    salaryBand: '$82k – $160k / ₹11L – ₹32L early-to-mid career',
    growthOutlook: '+24% projected 10-year demand',
    workplaceRoles: ['Lead Product Designer', 'Design Systems Architect', 'Spatial UX Researcher'],
    specializations: ['3D Spatial Interfaces', 'Medical & Accessibility Hardware', 'AI Workflow Interaction'],
    dailySimulationContext: 'Usability testing critiques, information architecture mapping, interactive prototyping, and engineering handoffs.',
  },
  {
    id: 'quant-finance-strategist',
    title: 'Quantitative Finance & Economic Strategist',
    domain: 'Commerce and Business',
    tagline: 'Model global capital flows, algorithmic risk, and sustainable financial strategy.',
    description:
      'Blends econometrics, stochastic calculus, and corporate strategy to price risk, allocate capital, and advise executive leadership.',
    accentColor: '#0369a1',
    eligibility12th: 'Mathematics mandatory (Commerce with Maths, PCM, or Humanities with Economics & Maths).',
    entranceExams: ['CUET (Economics/Finance)', 'IPMAT / NPAT', 'ISI Admission Test', 'CFA Level I (Final Year)'],
    recommendedCourses: ['B.A. (Hons) Economics & Econometrics', 'B.S. in Financial Engineering', 'B.Tech in Mathematics & Computing'],
    counsellingNotes: 'Target top quantitative economics colleges or math-computing programs during central university counselling.',
    requiredSkills: {
      'Analytical Reasoning': 90,
      'Systems Architecture': 75,
      'Applied Mathematics': 90,
      'Communication': 78,
      'Execution & Delivery': 76,
    },
    salaryBand: '$105k – $210k / ₹16L – ₹48L early-to-mid career',
    growthOutlook: '+19% projected 10-year demand',
    workplaceRoles: ['Quantitative Analyst', 'Risk Strategist', 'Macroeconomic Portfolio Associate'],
    specializations: ['Algorithmic Market Making', 'Climate Risk Valuation', 'Corporate Treasury & M&A'],
    dailySimulationContext: 'Backtesting risk models, scenario stress-testing, macroeconomic briefs, and live portfolio defense.',
  },
  {
    id: 'aerospace-robotics',
    title: 'Aerospace & Autonomous Robotics Engineer',
    domain: 'Technology and Engineering',
    tagline: 'Engineer autonomous vehicles, orbital craft, and high-precision electromechanical systems.',
    description:
      'Integrates aerodynamics, embedded control theory, CAD kinematics, and real-time sensor fusion for physical autonomous machines.',
    accentColor: '#334155',
    eligibility12th: 'Physics, Chemistry, Mathematics (PCM) with strong spatial geometry and mechanics intuition.',
    entranceExams: ['JEE Main & Advanced', 'IIST Admission', 'BITSAT', 'State Engineering Entrance'],
    recommendedCourses: ['B.Tech in Aerospace Engineering', 'B.Tech in Mechatronics & Robotics', 'B.E. in Mechanical & Control Systems'],
    counsellingNotes: 'Review wind-tunnel, robotics arena, and propulsion lab facilities during JoSAA/institute counselling.',
    requiredSkills: {
      'Analytical Reasoning': 86,
      'Systems Architecture': 86,
      'Applied Mathematics': 88,
      'Communication': 68,
      'Execution & Delivery': 84,
    },
    salaryBand: '$88k – $168k / ₹12L – ₹34L early-to-mid career',
    growthOutlook: '+22% projected 10-year demand',
    workplaceRoles: ['Flight Control Engineer', 'Autonomous Mobility Architect', 'Propulsion Systems Lead'],
    specializations: ['GNC (Guidance, Navigation & Control)', 'Swarm Drone Autonomy', 'Orbital Habitat Structures'],
    dailySimulationContext: 'PID loop tuning, payload mass budgets, hardware-in-the-loop failure analysis, and flight readiness reviews.',
  },
  {
    id: 'climate-sustainability',
    title: 'Agri-Climate Systems & Environmental Architect',
    domain: 'Agriculture and Environment',
    tagline: 'Design precision agriculture sensors, smart microgrids, and resilient ecosystems.',
    description:
      'Combines environmental modeling, power-grid engineering, and policy economics to accelerate decarbonization.',
    accentColor: '#059669',
    eligibility12th: 'Science stream (PCM or PCB with Mathematics) interested in physics, chemistry, and environmental systems.',
    entranceExams: ['JEE Main', 'CUET Science', 'IAT (IISER)', 'TERI / Energy Institute Entrance'],
    recommendedCourses: ['B.Tech in Energy & Environmental Engineering', 'B.S. in Earth & Climate Sciences', 'B.Tech in Electrical & Smart Grids'],
    counsellingNotes: 'Seek interdisciplinary programs pairing power engineering with climate policy and GIS telemetry.',
    requiredSkills: {
      'Analytical Reasoning': 80,
      'Systems Architecture': 80,
      'Applied Mathematics': 76,
      'Communication': 84,
      'Execution & Delivery': 80,
    },
    salaryBand: '$76k – $142k / ₹9L – ₹26L early-to-mid career',
    growthOutlook: '+29% projected 10-year demand',
    workplaceRoles: ['Grid Decarbonization Engineer', 'Climate Risk Modeler', 'Clean Energy Project Lead'],
    specializations: ['Grid-Scale Battery Storage', 'Urban Heat & Water Telemetry', 'Carbon Market Verification'],
    dailySimulationContext: 'Renewable load balancing, lifecycle emissions audits, grid resilience modeling, and stakeholder briefings.',
  },
  {
    id: 'tech-policy-law',
    title: 'Public Policy, Law & Governance Counsel',
    domain: 'Government, Law and Public Services',
    tagline: 'Draft regulatory frameworks for AI governance, public administration, and global digital commerce.',
    description:
      'Interprets complex technical systems through constitutional law, international treaties, and corporate compliance.',
    accentColor: '#6d28d9',
    eligibility12th: 'Any academic stream (Humanities, Commerce, or Science) with strong reading synthesis and argumentation.',
    entranceExams: ['CLAT (Common Law Admission Test)', 'AILET (NLU Delhi)', 'LSAT-India / Global', 'SLAT'],
    recommendedCourses: ['B.A. LL.B. (Hons)', 'B.Sc. LL.B. (Tech & IP Focus)', 'B.B.A. LL.B. Corporate & Regulatory Law'],
    counsellingNotes: 'Rank National Law Universities and law schools with active technology-policy clinics during CLAT counselling.',
    requiredSkills: {
      'Analytical Reasoning': 86,
      'Systems Architecture': 65,
      'Applied Mathematics': 55,
      'Communication': 94,
      'Execution & Delivery': 82,
    },
    salaryBand: '$85k – $175k / ₹11L – ₹36L early-to-mid career',
    growthOutlook: '+16% projected 10-year demand',
    workplaceRoles: ['AI Governance Counsel', 'IP & Patent Strategist', 'Global Privacy Compliance Lead'],
    specializations: ['Cross-Border Data Regulation', 'Open Source & Patent Law', 'Algorithmic Accountability'],
    dailySimulationContext: 'Contract redlining, regulatory risk memos, mock tribunal arguments, and board compliance reviews.',
  },
  {
    id: 'interactive-media-director',
    title: 'Interactive Simulation & Technical Media Producer',
    domain: 'Arts, Design and Media',
    tagline: 'Build real-time 3D worlds, educational engines, and interactive digital experiences.',
    description:
      'Fuses real-time graphics programming, narrative design, and sound/motion engineering into interactive worlds.',
    accentColor: '#be123c',
    eligibility12th: 'Any stream with Mathematics or Computer Science preferred for graphics tracks.',
    entranceExams: ['UCEED', 'JEE Main (CS/Media Tech)', 'CUET', 'Creative Coding & Portfolio Review'],
    recommendedCourses: ['B.Tech in Computer Science & Design', 'B.Des in Animation & Interactive Media', 'B.S. in Creative Computing'],
    counsellingNotes: 'Look for programs offering joint studios between computer graphics labs and visual storytelling departments.',
    requiredSkills: {
      'Analytical Reasoning': 76,
      'Systems Architecture': 82,
      'Applied Mathematics': 74,
      'Communication': 85,
      'Execution & Delivery': 86,
    },
    salaryBand: '$78k – $155k / ₹10L – ₹30L early-to-mid career',
    growthOutlook: '+25% projected 10-year demand',
    workplaceRoles: ['Technical Graphics Producer', 'Simulation Experience Lead', 'Interactive World Architect'],
    specializations: ['Real-Time WebGL & Spatial Engines', 'Procedural World Generation', 'Serious Games & EdTech Simulations'],
    dailySimulationContext: 'Frame-budget profiling, interactive narrative pacing, shader look-dev reviews, and user playtesting.',
  },
  {
    id: 'education-research-scientist',
    title: 'Curriculum Architect & Applied Research Fellow',
    domain: 'Education and Research',
    tagline: 'Lead scientific discovery, learning science labs, and national academic innovation programs.',
    description:
      'Combines experimental research design, pedagogical psychology, and computational assessment to advance institutional research and teaching.',
    accentColor: '#7c3aed',
    eligibility12th: 'Any core academic stream (Science, Humanities, or Commerce) with strong inquiry and analytical writing.',
    entranceExams: ['IAT (IISER Aptitude Test)', 'NEST', 'CUET Academic Track', 'NET / GATE (Postgrad Research)'],
    recommendedCourses: ['B.S.-M.S. Dual Degree in Sciences', 'B.Ed. Integrated Learning Sciences', 'B.A./B.Sc. (Hons) Research Track'],
    counsellingNotes: 'Target research universities with funded undergraduate thesis labs and national fellowship pathways.',
    requiredSkills: {
      'Analytical Reasoning': 86,
      'Systems Architecture': 72,
      'Applied Mathematics': 76,
      'Communication': 92,
      'Execution & Delivery': 80,
    },
    salaryBand: '$68k – $135k / ₹8L – ₹25L early-to-mid career',
    growthOutlook: '+18% projected 10-year demand',
    workplaceRoles: ['Principal Learning Scientist', 'Academic Research Fellow', 'EdTech Curriculum Director'],
    specializations: ['Cognitive Learning Analytics', 'Adaptive STEM Labs', 'Scientific Grant & Policy Research'],
    dailySimulationContext: 'Hypothesis testing, peer-review critiques, lab cohort mentoring, and experimental curriculum design.',
  },
  {
    id: 'aviation-hospitality-director',
    title: 'Aviation Operations & Global Hospitality Strategist',
    domain: 'Aviation, Hospitality',
    tagline: 'Orchestrate commercial flight operations, airport experience, and luxury hospitality logistics.',
    description:
      'Blends aviation safety regulations, fleet scheduling optimization, and high-touch international guest operations.',
    accentColor: '#d97706',
    eligibility12th: '12th Standard with Physics & Mathematics for commercial pilot/aviation ops, or any stream for hospitality leadership.',
    entranceExams: ['DGCA Commercial Pilot Ground Exams', 'NCHMCT JEE', 'IPMAT / Aviation Management CET', 'IGRUA Entrance'],
    recommendedCourses: ['B.Sc. in Aviation & Flight Operations', 'B.B.A. in Airport & Aviation Management', 'B.Sc. in Hospitality & Hotel Administration'],
    counsellingNotes: 'Compare accredited flying training organizations, simulator hours, and international hospitality placements.',
    requiredSkills: {
      'Analytical Reasoning': 78,
      'Systems Architecture': 76,
      'Applied Mathematics': 74,
      'Communication': 92,
      'Execution & Delivery': 90,
    },
    salaryBand: '$72k – $165k / ₹8L – ₹35L early-to-mid career',
    growthOutlook: '+23% projected 10-year demand',
    workplaceRoles: ['Flight Operations Coordinator', 'Airport Terminal Experience Lead', 'Global Hospitality Director'],
    specializations: ['Air Traffic & Dispatch Operations', 'Luxury Resort & Cruise Operations', 'Airline Revenue Strategy'],
    dailySimulationContext: 'Crew turnaround dispatch, weather contingency routing, VIP guest escalation, and safety compliance drills.',
  },
];

export function buildDefaultRoadmapForCareer(career: CareerDefinition, advancedUnlocked = false): RoadmapStage[] {
  const stages: RoadmapStage[] = [
    {
      id: 'stage-1',
      stageNumber: 1,
      stageType: 'after_12th',
      title: 'LEVEL 01 – After 12th',
      subtitle: 'Required stream, subject combinations, immediate post-12th choices, and foundational readiness',
      buildingId: 'building-admissions',
      buildingName: 'Admissions & Exam Pavilion',
      environmentName: '12th Foundation Hall',
      unlocked: true,
      completed: false,
      milestones: [
        { id: 'm1-elig', title: '12th Standard Stream & Eligibility Check', detail: career.eligibility12th, completed: false },
        { id: 'm1-courses', title: 'Target Degree & Diploma Options', detail: `Recommended tracks: ${career.recommendedCourses.join(' · ')}`, completed: false },
        { id: 'm1-prep', title: 'Early Preparation Habits', detail: `Build strong conceptual clarity in core subjects before board exams and entrance tests.`, completed: false },
      ],
      missions: [
        {
          id: `${career.id}-mission-1`,
          stageId: 'stage-1',
          title: 'After-12th Eligibility & Stream Alignment Blueprint',
          category: 'exam_prep',
          locationLabel: 'Admissions & Exam Pavilion · Desk 01',
          summary: `Confirm your post-12th academic stream, target undergraduate programs, and backup choices for ${career.title}.`,
          scenarioContext: `You have completed or are preparing for 12th Standard and want to enter ${career.title}. Eligibility requires: ${career.eligibility12th}`,
          taskPrompt: `1) Choose the strongest after-12th planning strategy below, and 2) Write 2–3 sentences explaining how your current 12th subjects align with ${career.recommendedCourses[0]} and what foundational gap you will strengthen first.`,
          multipleChoiceQuestion: {
            question: `Which post-12th academic planning step sets the strongest foundation for ${career.title}?`,
            options: [
              'Pick a college purely by campus popularity without checking 12th subject prerequisites.',
              'Verify subject eligibility, shortlist accredited degree programs, and strengthen core concepts early.',
              'Wait until board results arrive before checking which degrees exist.',
              'Skip foundational subjects and jump straight into advanced buzzwords.',
            ],
            correctIndex: 1,
          },
          evaluationCriteria: [
            'Verifies post-12th eligibility and degree alignment',
            'Identifies a concrete subject or skill foundation to strengthen',
          ],
          hints: [
            'Review the eligibility requirements and target degree list above.',
            'Connect one subject you study now directly to your first-year degree coursework.',
          ],
          learningSupport: `After-12th Guide: Confirm ${career.eligibility12th}, shortlist 3–5 degree tracks like ${career.recommendedCourses[0]}, and lock your foundational study routine.`,
          skillRewards: { 'Analytical Reasoning': 5, 'Execution & Delivery': 4 },
        },
      ],
    },
    {
      id: 'stage-2',
      stageNumber: 2,
      stageType: 'entrance_exams',
      title: 'LEVEL 02 – Entrance Examinations',
      subtitle: 'Qualifying exams, eligibility rules, exam structure, preparation strategy, and admission counselling',
      buildingId: 'building-admissions',
      buildingName: 'Admissions & Exam Pavilion',
      environmentName: 'Exam & Counselling Wing',
      unlocked: true,
      completed: false,
      milestones: [
        { id: 'm2-exams', title: 'Qualifying Entrance Examinations', detail: `Target exams: ${career.entranceExams.join(' · ')}`, completed: false },
        { id: 'm2-pattern', title: 'Mock Tests & Exam Structure Mastery', detail: 'Analyze syllabus weightage, speed vs. accuracy, and weekly diagnostic mocks.', completed: false },
        { id: 'm2-counselling', title: 'Admission & Counselling Strategy', detail: career.counsellingNotes, completed: false },
      ],
      missions: [
        {
          id: `${career.id}-mission-2`,
          stageId: 'stage-2',
          title: 'Entrance Exam & Counselling Preference Simulation',
          category: 'counselling',
          locationLabel: 'Admissions & Exam Pavilion · Hall B',
          summary: `Design your qualifying exam timetable and tiered counselling preference list for ${career.title}.`,
          scenarioContext: `Key qualifying exams for ${career.title} include ${career.entranceExams.join(', ')}. ${career.counsellingNotes}`,
          taskPrompt: `Write a 2–3 sentence preparation & counselling plan explaining how you will balance primary exams (${career.entranceExams[0]}) with safe backup exams (${career.entranceExams[1] || 'state/university tests'}) and tiered college choices.`,
          multipleChoiceQuestion: {
            question: `When submitting your counselling preference list for ${career.recommendedCourses[0]}, which approach minimizes admission risk while maximizing career fit?`,
            options: [
              'List only one dream institute so you never settle for a second choice.',
              'Build a tiered list combining ambitious, realistic, and safe institutes with strong labs and curriculum alignment.',
              'Skip entrance mock tests and decide your branch after results are published.',
              'Choose purely by city distance without checking curriculum or accreditation.',
            ],
            correctIndex: 1,
          },
          evaluationCriteria: [
            'Accurately identifies tiered counselling risk management',
            'Names concrete exam preparation cadence or milestone',
            'Aligns backup exam options with degree goals',
          ],
          hints: [
            'Include at least one primary exam and one backup counselling pathway.',
            'Explain how weekly mock diagnostics guide your revision priorities.',
          ],
          learningSupport: `Exam Playbook: Start with a baseline mock in ${career.entranceExams[0]}, track error logs weekly, and finalize a balanced 3-tier college preference order before counselling deadlines.`,
          skillRewards: { 'Analytical Reasoning': 6, 'Execution & Delivery': 6 },
        },
      ],
    },
    {
      id: 'stage-3',
      stageNumber: 3,
      stageType: 'college_journey',
      title: 'LEVEL 03 – College Journey',
      subtitle: 'Year 1 to Final Year academic progression: core subjects, practicals, projects, and certifications',
      buildingId: 'building-foundations',
      buildingName: 'Foundations Academic Hall',
      environmentName: 'Undergraduate Campus Commons',
      unlocked: true,
      completed: false,
      milestones: [
        { id: 'm3-y1', title: 'Year 1 · Core Fundamentals & Campus Labs', detail: `Build bedrock skills in ${career.recommendedCourses[0]} with hands-on practicals.`, completed: false },
        { id: 'm3-y23', title: 'Year 2 & Year 3 · Domain Depth & Electives', detail: `Complete intermediate projects, certifications, and summer research/internships.`, completed: false },
        { id: 'm3-y4', title: 'Final Year · Capstone & Portfolio Defense', detail: 'Deliver a measurable final-year capstone aligned with real industry standards.', completed: false },
      ],
      missions: [
        {
          id: `${career.id}-mission-3`,
          stageId: 'stage-3',
          title: 'Year-by-Year College Studio Lab Challenge',
          category: 'academic',
          locationLabel: 'Foundations Academic Hall · Studio Lab 2',
          summary: `Solve a core undergraduate lab problem across Year 1–4 foundations in ${career.domain}.`,
          scenarioContext: `During your degree (${career.recommendedCourses[0]}), faculty assign a cross-semester project requiring structured problem decomposition, lab verification, and clear documentation.`,
          taskPrompt: `Outline how you would break down a ${career.domain} college project from initial requirements to a tested prototype, naming one validation check you would run before submission.`,
          multipleChoiceQuestion: {
            question: 'What habit separates top college performers from rote learners across Years 1 to 4?',
            options: [
              'Memorizing final answers without testing edge cases.',
              'Breaking problems into small verifiable modules, building real projects each semester, and testing early.',
              'Waiting until final semester before building any practical portfolio.',
              'Working completely in isolation without peer or faculty feedback.',
            ],
            correctIndex: 1,
          },
          evaluationCriteria: [
            'Shows structured step-by-step decomposition',
            'Includes a concrete validation or verification method',
          ],
          hints: [
            'Think in 3 steps: Define requirements -> Build minimal prototype -> Verify with a test metric.',
          ],
          learningSupport: `College Journey Guide: Pair each academic semester with one tangible project or certification so your skills compound from Year 1 through graduation.`,
          skillRewards: { 'Applied Mathematics': 6, 'Systems Architecture': 6, 'Communication': 5 },
        },
      ],
    },
    {
      id: 'stage-4',
      stageNumber: 4,
      stageType: 'skills_experience',
      title: 'LEVEL 04 – Skills and Experience',
      subtitle: 'Practical hands-on activities, real-world projects, internships, and industry exposure',
      buildingId: 'building-innovation',
      buildingName: 'Innovation & Internship Lab',
      environmentName: 'Applied Industry Wing',
      unlocked: true,
      completed: false,
      milestones: [
        { id: 'm4-projects', title: 'Portfolio-Grade Practical Projects', detail: 'Ship verifiable artifacts showing measurable accuracy, reliability, or impact.', completed: false },
        { id: 'm4-intern', title: 'Real-World Internship Simulation', detail: `Practice daily constraints: ${career.dailySimulationContext}`, completed: false },
      ],
      missions: [
        {
          id: `${career.id}-mission-4`,
          stageId: 'stage-4',
          title: 'Internship Trade-Off & Industry Exposure Sprint',
          category: 'internship',
          locationLabel: 'Innovation & Internship Lab · Bay 4',
          summary: `Respond to an urgent mid-internship deadline challenge as a ${career.title} intern.`,
          scenarioContext: `Week 4 of your industry internship: ${career.dailySimulationContext} Your team lead asks for a recommendation under a 48-hour deadline where ideal perfection conflicts with shipping a reliable baseline.`,
          taskPrompt: `Propose your action plan: What trade-off will you make to meet the 48-hour milestone safely, how will you communicate risk to your team lead, and what follow-up check will you schedule next week?`,
          multipleChoiceQuestion: {
            question: 'During a high-stakes internship sprint with tight deadlines, what demonstrates top professional judgment?',
            options: [
              'Silently skipping quality checks so the demo looks finished.',
              'Shipping a clearly scoped, verified baseline on time while transparently flagging known limitations and a mitigation plan.',
              'Rewriting the entire system from scratch without telling your manager.',
              'Waiting silently for someone else to assign every micro-task.',
            ],
            correctIndex: 1,
          },
          evaluationCriteria: [
            'Balances delivery speed with safety/quality',
            'Demonstrates proactive stakeholder communication',
            'Proposes concrete follow-up validation',
          ],
          hints: [
            'State clearly what stays in scope for 48 hours and what moves to phase 2.',
            'Managers value early risk visibility paired with a concrete mitigation plan.',
          ],
          learningSupport: `Internship Playbook: Scope down to a reliable core deliverable, document edge-case risks explicitly, and propose a concrete timeline for hardening.`,
          skillRewards: { 'Systems Architecture': 8, 'Execution & Delivery': 8, 'Communication': 6 },
        },
      ],
    },
    {
      id: 'stage-5',
      stageNumber: 5,
      stageType: 'job_opportunities',
      title: 'LEVEL 05 – Job Opportunities',
      subtitle: 'Entry-to-mid roles, daily workplace responsibilities, placement interviews, and compensation reality',
      buildingId: 'building-placement',
      buildingName: 'Placement & Interview Center',
      environmentName: 'Career Placement Hub',
      unlocked: true,
      completed: false,
      milestones: [
        { id: 'm5-roles', title: 'Target Entry & Mid-Level Job Roles', detail: `Core roles: ${career.workplaceRoles.join(' · ')}`, completed: false },
        { id: 'm5-day', title: 'Daily Responsibilities & Work Culture', detail: career.dailySimulationContext, completed: false },
        { id: 'm5-offer', title: 'Placement Panel & Job Offer Gate', detail: `Expected band: ${career.salaryBand}`, completed: false },
      ],
      missions: [
        {
          id: `${career.id}-mission-5`,
          stageId: 'stage-5',
          title: 'Final Placement Interview Simulation (Job Offer Gate)',
          category: 'placement_interview',
          locationLabel: 'Placement & Interview Center · Boardroom 1',
          summary: `Complete the panel interview simulation to earn your ${career.workplaceRoles[0]} job offer.`,
          scenarioContext: `Hiring Panel Question for ${career.workplaceRoles[0]}: "Walk us through a demanding problem you solved, why you chose your approach over alternatives, how you measured success, and one flaw you fixed along the way."`,
          taskPrompt: `Deliver a crisp STAR-structured interview response (Situation, Task, Action, Result) tailored to ${career.title}, including concrete metrics and a reflection on trade-offs.`,
          multipleChoiceQuestion: {
            question: 'When a placement interviewer challenges a flaw in your project design, what is the strongest response?',
            options: [
              'Become defensive and argue that the requirement was unclear.',
              'Acknowledge the constraint directly, explain the trade-off you originally made, and outline how you would redesign it at scale.',
              'Change the subject to an unrelated certificate.',
              'Guess an answer even if you are unsure of the mechanics.',
            ],
            correctIndex: 1,
          },
          evaluationCriteria: [
            'Uses clear Situation-Task-Action-Result structure',
            'Cites measurable impact or verification metric',
            'Shows honest reflection and professional maturity',
          ],
          hints: [
            'Include a specific metric (e.g., error reduced by 30%, response time improved, or defects caught early).',
            'Explicitly name one alternative approach you considered.',
          ],
          learningSupport: `Interview Coaching: Great candidates quantify results, own trade-offs calmly, and connect academic/internship work directly to the employer's daily responsibilities.`,
          skillRewards: { 'Communication': 10, 'Analytical Reasoning': 8, 'Execution & Delivery': 8 },
          isJobOfferGate: true,
        },
      ],
    },
    {
      id: 'stage-6',
      stageNumber: 6,
      stageType: 'future_scope',
      title: 'LEVEL 06 – Future Scope',
      subtitle: '10-year industry demand, emerging technologies, advanced specializations, and higher education paths',
      buildingId: 'building-workplace',
      buildingName: 'Executive Industry Tower',
      environmentName: 'Future Horizon Deck',
      unlocked: true,
      completed: false,
      milestones: [
        { id: 'm6-demand', title: 'Long-Term Industry Demand', detail: `${career.growthOutlook} with expanding global opportunities.`, completed: false },
        { id: 'm6-spec', title: 'High-Value Specializations', detail: `Emerging tracks: ${career.specializations.join(' · ')}`, completed: false },
        { id: 'm6-higher', title: 'Higher Education & Leadership Growth', detail: 'Evaluate M.Tech/M.S./MBA/PhD or Principal specialist pathways.', completed: false },
      ],
      missions: [
        {
          id: `${career.id}-mission-6`,
          stageId: 'stage-6',
          title: 'Future Specialization & 5-Year Career Growth Plan',
          category: 'workplace',
          locationLabel: 'Executive Industry Tower · Level 24',
          summary: `Chart your long-term specialization, continuous learning, and leadership growth in ${career.title}.`,
          scenarioContext: `Two years into your career as ${career.workplaceRoles[0]}, emerging shifts around ${career.specializations[0]} and ${career.specializations[1]} are reshaping your field.`,
          taskPrompt: `Draft your 90-day & 3-year growth proposal: pick a specialization (${career.specializations[0]} or ${career.specializations[1]}), name one cross-team initiative or higher-study milestone, and explain how you will measure impact.`,
          evaluationCriteria: [
            'Connects specialization choice to future industry demand',
            'Includes mentorship, research, or cross-team leadership',
            'Defines measurable growth milestones',
          ],
          hints: [
            'Structure your response across Immediate 90-Day Skill Up -> 1-Year Project Impact -> 3-Year Specialization or Higher Study.',
          ],
          learningSupport: `Future Scope Guide: Long-term resilience comes from pairing deep domain mastery with emerging specializations (${career.specializations.join(', ')}) and lifelong adaptability.`,
          skillRewards: { 'Systems Architecture': 8, 'Communication': 8, 'Execution & Delivery': 10 },
        },
      ],
    },
  ];

  if (advancedUnlocked) {
    stages[5].missions.push({
      id: `${career.id}-mission-advanced`,
      stageId: 'stage-6',
      title: 'Advanced Principal Leadership Challenge',
      category: 'advanced',
      locationLabel: 'Executive Industry Tower · Observatory Penthouse',
      summary: `Unlocked by high satisfaction: solve an executive-level ${career.specializations[0]} challenge.`,
      scenarioContext: `As a rising Principal Specialist in ${career.title}, you must resolve a multi-year strategic dilemma balancing reliability, ethics/compliance, and breakthrough innovation.`,
      taskPrompt: `Design an executive decision memo addressing a high-impact scaling bottleneck in ${career.specializations[0]}. Specify governance guardrails, resource allocation, and 12-month KPIs.`,
      evaluationCriteria: [
        'Demonstrates systems-level strategic thinking',
        'Integrates ethics/risk guardrails with execution KPIs',
      ],
      hints: [
        'Balance short-term risk mitigation with long-term capability building.',
      ],
      learningSupport: `Advanced Track: Senior leaders frame ambiguity into crisp decision options with clear trade-offs and measurable guardrails.`,
      skillRewards: { 'Analytical Reasoning': 10, 'Systems Architecture': 10, 'Communication': 8 },
      isAdvanced: true,
    });
  }

  return stages;
}

export interface CareerVideoSessionTemplate {
  sessionKey: string;
  levelNumber: number;
  stageLabel: string;
  title: string;
  subtitle: string;
  animationPrompt: string;
  narrationScript: string;
  keyTakeaways: string[];
  subtitles: { startSec: number; endSec: number; text: string }[];
  checkpoint: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export function buildCareerVideoSessionTemplates(
  career: CareerDefinition
): CareerVideoSessionTemplate[] {
  const primaryExam = career.entranceExams[0] || 'National Entrance Exam';
  const secondaryExam = career.entranceExams[1] || 'University Admissions Test';
  const primaryCourse = career.recommendedCourses[0] || 'Undergraduate Honours Degree';
  const primaryRole = career.workplaceRoles[0] || career.title;
  const primarySpec = career.specializations[0] || career.domain;

  return [
    {
      sessionKey: 'after-12th',
      levelNumber: 1,
      stageLabel: 'Session 01 · After 12th Pass',
      title: `After 12th Pass: Starting ${career.title}`,
      subtitle: 'Required 12th subjects, stream clarity, and choosing the right undergraduate track',
      animationPrompt: `Vibrant futuristic 3D educational animation showing a confident 12th-grade student stepping through a glowing holographic academic gateway labeled "${primaryCourse}", surrounded by floating subject icons for ${career.domain}, warm golden-orange lighting inside a sleek deep violet study studio, smooth orbital camera motion.`,
      narrationScript: `Welcome to Session One of your ${career.title} journey! Right after passing 12th grade, your first milestone is confirming subject eligibility: ${career.eligibility12th} From here, target degree programs such as ${primaryCourse} to build strong fundamentals from day one.`,
      keyTakeaways: [
        `Eligibility: ${career.eligibility12th}`,
        `Primary Degree Path: ${primaryCourse}`,
        `Early Habit: Focus on conceptual clarity in core 12th subjects before rushing ahead.`,
      ],
      subtitles: [
        { startSec: 0, endSec: 2, text: `Session 01: Right after 12th pass for ${career.title}.` },
        { startSec: 2, endSec: 4, text: `Verify prerequisites: ${career.eligibility12th.slice(0, 72)}.` },
        { startSec: 4, endSec: 6, text: `Target top degrees like ${primaryCourse}.` },
      ],
      checkpoint: {
        question: `What should your immediate priority be right after 12th pass when targeting ${career.title}?`,
        options: [
          'Skip checking subject prerequisites and apply randomly.',
          `Verify eligibility (${career.eligibility12th.slice(0, 48)}...) and shortlist accredited ${primaryCourse} tracks.`,
          'Wait until after college admissions close to pick a domain.',
        ],
        correctIndex: 1,
        explanation: `Checking prerequisites early ensures you qualify cleanly for ${primaryCourse} and related entrance exams.`,
      },
    },
    {
      sessionKey: 'entrance-exams',
      levelNumber: 2,
      stageLabel: 'Session 02 · Qualifying Exams',
      title: `Qualifying Entrance Exams & Counselling`,
      subtitle: `How to prepare for ${primaryExam}, backup tests, and smart admission counselling`,
      animationPrompt: `Clean modern animated explainer scene inside a glowing violet and amber holographic exam command center showing milestones for "${primaryExam}" and "${secondaryExam}", animated timeline bars rising cleanly, focused student solving diagnostic problems on a translucent glass screen, cinematic lighting.`,
      narrationScript: `In Session Two, let us decode the qualifying entrance exams for ${career.title}. Your key exams include ${career.entranceExams.slice(0, 3).join(', ')}. Pair weekly timed mock tests with smart counselling so you balance ambitious dream colleges with reliable backup options.`,
      keyTakeaways: [
        `Key Exams: ${career.entranceExams.join(' · ')}`,
        `Counselling Strategy: ${career.counsellingNotes}`,
        `Prep Rule: Review every mock test error log before learning new chapters.`,
      ],
      subtitles: [
        { startSec: 0, endSec: 2, text: `Qualifying exams: ${career.entranceExams.slice(0, 2).join(' & ')}.` },
        { startSec: 2, endSec: 4, text: 'Run weekly mock tests and review mistakes systematically.' },
        { startSec: 4, endSec: 6, text: 'Lock a balanced 3-tier college preference list in counselling.' },
      ],
      checkpoint: {
        question: `Which exam and counselling strategy gives you the highest chance of securing a great seat for ${career.title}?`,
        options: [
          `Prepare for ${primaryExam} plus backup exams like ${secondaryExam}, and rank a 3-tier counselling list.`,
          'Apply to only a single institute without taking mock tests.',
          'Ignore exam syllabus weightage completely.',
        ],
        correctIndex: 0,
        explanation: `Combining primary + backup exams with a tiered counselling list protects your options while aiming high.`,
      },
    },
    {
      sessionKey: 'college-years',
      levelNumber: 3,
      stageLabel: 'Session 03 · Studying Years (Year 1–4)',
      title: `Your Studying Years Journey (Year 1 to Graduation)`,
      subtitle: 'What you actually study semester-by-semester, lab practicals, projects, and milestones',
      animationPrompt: `Dynamic animated 3D architectural time-lapse of a student progressing across four glowing college studio levels from Year 1 foundations to Year 4 capstone showcase in ${career.domain}, holographic blueprints and lab instruments floating in purple and warm amber light, crisp educational motion.`,
      narrationScript: `Session Three walks through your college studying years inside ${primaryCourse}. Year One anchors core theory and campus practicals. Years Two and Three deepen domain electives, competitions, and summer internships. By Final Year, your capstone project proves you are ready for real industry problems.`,
      keyTakeaways: [
        'Year 1: Core theory, lab discipline, and peer study groups.',
        'Years 2–3: Domain specializations, certifications, and first industry internship.',
        'Final Year: Measurable capstone project and placement portfolio.',
      ],
      subtitles: [
        { startSec: 0, endSec: 2, text: `Year 1 inside ${primaryCourse}: master foundational labs.` },
        { startSec: 2, endSec: 4, text: 'Years 2–3: electives, hands-on builds & summer internships.' },
        { startSec: 4, endSec: 6, text: 'Final Year: ship a standout capstone for placements.' },
      ],
      checkpoint: {
        question: 'How do successful college students turn coursework into real career readiness across Years 1 to 4?',
        options: [
          'Only study slides the night before exams.',
          'Pair each year with practical labs, real projects, and summer internship experience.',
          'Avoid faculty feedback and teamwork.',
        ],
        correctIndex: 1,
        explanation: 'Compounding practical builds and internships each year creates undeniable proof of ability by graduation.',
      },
    },
    {
      sessionKey: 'skills-internships',
      levelNumber: 4,
      stageLabel: 'Session 04 · Skills & Internships',
      title: `Practical Skills, Projects & Industry Exposure`,
      subtitle: 'Building verified competencies and handling real-world internship expectations',
      animationPrompt: `Futuristic animated collaborative lab workspace in ${career.domain}, diverse young professionals prototyping and inspecting live 3D holographic metrics and schematics together, sleek dark indigo background with golden amber highlights, smooth steady pan.`,
      narrationScript: `Welcome to Session Four: Skills and Experience! Employers look beyond grades to see how you apply ${Object.keys(career.requiredSkills).slice(0, 3).join(', ')}. Real internships teach you how to deliver reliable work under tight deadlines and communicate risks clearly with your team.`,
      keyTakeaways: [
        `Top Skills: ${Object.entries(career.requiredSkills).map(([k, v]) => `${k} (${v}+)`).slice(0, 3).join(' · ')}`,
        `Real Practice: ${career.dailySimulationContext}`,
        'Portfolio Tip: Always document measurable outcomes, not just tool names.',
      ],
      subtitles: [
        { startSec: 0, endSec: 2, text: `Core skills: ${Object.keys(career.requiredSkills).slice(0, 3).join(', ')}.` },
        { startSec: 2, endSec: 4, text: 'Internships test reliability under real team deadlines.' },
        { startSec: 4, endSec: 6, text: 'Document measurable results in every portfolio project.' },
      ],
      checkpoint: {
        question: 'What makes a student internship project stand out to hiring panels?',
        options: [
          'Listing tool buzzwords without explaining what problem was solved.',
          'Showing clear trade-offs, verified testing, and measurable outcomes.',
          'Hiding bugs during team reviews.',
        ],
        correctIndex: 1,
        explanation: 'Hiring panels trust candidates who measure results, explain trade-offs, and test thoroughly.',
      },
    },
    {
      sessionKey: 'daily-job',
      levelNumber: 5,
      stageLabel: 'Session 05 · Daily Job Reality',
      title: `Inside the Job: How ${primaryRole} Actually Works`,
      subtitle: `Daily workflow, workplace environment, responsibilities, and compensation outlook`,
      animationPrompt: `Cinematic futuristic animated day-in-the-life scene of a ${primaryRole} at work in a sunlit modern ${career.domain} hub, reviewing ${career.dailySimulationContext} on transparent displays with teammates, warm golden hour glow with deep purple ambient accents, documentary animation.`,
      narrationScript: `Session Five brings you inside the real job as a ${primaryRole}! Your daily workflow centers on ${career.dailySimulationContext} You collaborate across teams, solve high-impact problems, and earn ${career.salaryBand} as you grow in responsibility.`,
      keyTakeaways: [
        `Roles: ${career.workplaceRoles.join(' · ')}`,
        `Daily Reality: ${career.dailySimulationContext}`,
        `Compensation Band: ${career.salaryBand}`,
      ],
      subtitles: [
        { startSec: 0, endSec: 2, text: `Step inside the daily life of a ${primaryRole}.` },
        { startSec: 2, endSec: 4, text: `Key work: ${career.dailySimulationContext.slice(0, 72)}.` },
        { startSec: 4, endSec: 6, text: `Early-to-mid compensation: ${career.salaryBand}.` },
      ],
      checkpoint: {
        question: `Which description best reflects daily responsibilities for a ${primaryRole}?`,
        options: [
          'Working completely alone with zero collaboration or reviews.',
          `Handling ${career.dailySimulationContext.slice(0, 65)}... with team collaboration.`,
          'Never having to learn new workflows after graduation.',
        ],
        correctIndex: 1,
        explanation: `Real ${career.title} work blends domain expertise with cross-functional reviews and continuous problem solving.`,
      },
    },
    {
      sessionKey: 'future-scope',
      levelNumber: 6,
      stageLabel: 'Session 06 · Future Scope & Growth',
      title: `Future Scope: ${primarySpec} & Next 10 Years`,
      subtitle: `${career.growthOutlook}, emerging trends, specializations, and leadership pathways`,
      animationPrompt: `Inspiring futuristic animated horizon vista overlooking a glowing next-generation innovation campus, holographic pathways branching toward "${career.specializations.slice(0, 2).join('" and "')}", golden sunbeams and violet light trails symbolizing 10-year career growth.`,
      narrationScript: `Finally, Session Six looks ahead at the future scope of ${career.title}. With ${career.growthOutlook}, professionals can specialize in ${career.specializations.join(', ')}, pursue advanced master's or research fellowships, or lead global teams shaping the next decade.`,
      keyTakeaways: [
        `Demand Outlook: ${career.growthOutlook}`,
        `Emerging Specializations: ${career.specializations.join(' · ')}`,
        'Growth Path: Senior Specialist, Research Lead, or Executive Strategist.',
      ],
      subtitles: [
        { startSec: 0, endSec: 2, text: `Future outlook: ${career.growthOutlook}.` },
        { startSec: 2, endSec: 4, text: `Specialize in ${career.specializations.slice(0, 2).join(' or ')}.` },
        { startSec: 4, endSec: 6, text: 'Advance into Principal Leadership, Research, or Higher Studies.' },
      ],
      checkpoint: {
        question: `What keeps your ${career.title} career resilient over the next 10 years?`,
        options: [
          'Refusing to update skills once you land your first job.',
          `Building depth in high-growth specializations like ${primarySpec} and continuous learning.`,
          'Ignoring emerging industry tools and ethics.',
        ],
        correctIndex: 1,
        explanation: `Expanding into emerging areas such as ${primarySpec} multiplies long-term career impact and leadership opportunities.`,
      },
    },
    {
      sessionKey: 'career-overview',
      levelNumber: 0,
      stageLabel: 'Overview · Complete 12th-to-Job Arc',
      title: `${career.title}: Complete Journey Overview`,
      subtitle: 'Big-picture visual recap from 12th pass to qualifying exams, degree years, and dream career',
      animationPrompt: `Epic animated infographic journey map in deep violet and radiant gold connecting 12th Grade graduation, "${primaryExam}", "${primaryCourse}", real-world studio teamwork, and "${primaryRole}" leadership sky-deck in one seamless forward-moving camera flythrough.`,
      narrationScript: `Here is your complete VECTORA career arc for ${career.title}: start with strong 12th fundamentals, qualify through ${primaryExam}, build projects and internships inside ${primaryCourse}, step into roles like ${primaryRole}, and grow with ${career.growthOutlook}!`,
      keyTakeaways: [
        `Pathway: 12th Pass → ${primaryExam} → ${primaryCourse} → ${primaryRole}`,
        `Outlook: ${career.growthOutlook}`,
        `Next Step: Watch each session and explore the matching 3D World pavilion!`,
      ],
      subtitles: [
        { startSec: 0, endSec: 2, text: `Your complete ${career.title} arc from 12th pass to industry.` },
        { startSec: 2, endSec: 4, text: `${primaryExam} → ${primaryCourse} → Real Internships.` },
        { startSec: 4, endSec: 6, text: `Step into ${primaryRole} (${career.growthOutlook}).` },
      ],
      checkpoint: {
        question: 'What is the full VECTORA sequence from 12th pass to workplace readiness?',
        options: [
          'Skip exams and degrees entirely.',
          `12th Eligibility → Qualifying Exams (${primaryExam}) → College & Internships → Job Roles (${primaryRole}) → Future Growth.`,
          'Only study after getting hired.',
        ],
        correctIndex: 1,
        explanation: 'Every stage builds on the previous one to turn early curiosity into lasting career mastery.',
      },
    },
  ];
}
