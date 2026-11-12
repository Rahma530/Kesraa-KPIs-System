// AI_ENGINEER removed per explicit business decision (2026-10-22): it is a
// job title only (shown via getStandardRole for dept-ai), never a
// permission tier. No employee held this system_role at the time of removal.
export type SystemRole =
  | 'ADMIN'
  | 'HR'
  | 'CEO'
  | 'TEAM_LEADER'
  | 'HEAD_TECHNICAL'
  | 'EMPLOYEE';

export type AdditionalSystemPermission = 'ADMIN';

// Added for the Sales/TeleSales module: lets the ADMIN additional permission be limited
// to one department instead of the whole system. An employee with ADMIN and no scope
// keeps today's system-wide behavior (e.g. Head Technical) — nothing changes for them.
// An employee with ADMIN and a scope (e.g. a new Sales Admin) only gets ADMIN-level
// capabilities for evaluations/employees inside that one department.
export interface AdditionalPermissionScope {
  departmentId: string;
}

export type EmployeeLevel = 'Junior' | 'Mid' | 'Senior' | 'Team Leader';

export type EvaluationQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type EvaluationStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED';

export type KPICategory = 'COMMON' | 'DEPARTMENT' | 'LEADERSHIP' | 'MANAGEMENT';

export interface ScoringRubric {
  excellent: string; // 9-10
  good: string;      // 7-8
  needsImprovement: string; // 5-6
  poor: string;      // 3-4
  critical: string;  // 1-2
}

export interface LevelExpectations {
  junior: string;
  mid: string;
  senior: string;
  teamLeader: string;
}

// Added for the Sales/TeleSales module: most existing KPIs are judged by a human
// evaluator against the text bands in scoringGuide (RUBRIC — the only behavior that
// existed before). A METRIC KPI is instead computed automatically from an actual
// number recorded for the employee/month, compared against targetValue.
export type KPIMeasurementType = 'RUBRIC' | 'METRIC';
export type KPIMetricUnit = 'SAR' | 'COUNT' | 'PERCENT' | 'SECONDS';

export interface KPIDefinition {
  id: string;
  name: string;
  category: KPICategory;
  departmentId?: string; // If department specific
  roleName?: string;     // If role specific (e.g. SEO Web Developer vs SEO Specialist)
  weight: number;        // Percentage, e.g. 7 for 7%
  description: string;
  measurementMethod?: string;
  scoringGuide: ScoringRubric;
  levelExpectations?: LevelExpectations;
  isActive: boolean;
  // Omitted/undefined is treated as 'RUBRIC', so every existing KPI keeps behaving
  // exactly as it does today without needing to be touched.
  measurementType?: KPIMeasurementType;
  metricUnit?: KPIMetricUnit;
  // Monthly target used only when measurementType === 'METRIC' (e.g. 30 meetings,
  // 20000 SAR, 80 for an 80% conversion target).
  targetValue?: number;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  teamLeaderId?: string;
  teamLeaderName?: string;
  isActive: boolean;
}

export interface Employee {
  id: string;
  authUserId?: string;
  accountEnabled?: boolean;
  additionalPermissions?: AdditionalSystemPermission[];
  // Optional department scope for the ADMIN additional permission above. See
  // AdditionalPermissionScope for the exact meaning (absent = system-wide, as today).
  additionalPermissionScope?: AdditionalPermissionScope;
  name: string;
  email: string;
  departmentId: string;
  departmentName: string;
  role: string;
  level: EmployeeLevel;
  teamLeaderId?: string;
  teamLeaderName?: string;
  startDate: string; // YYYY-MM-DD
  isActive: boolean;
  isHeadTechnical?: boolean;
  systemRole: SystemRole;
  phone?: string;
  salary?: number;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationScoreItem {
  id: string;
  kpiId: string;
  kpiName: string;
  category: KPICategory;
  score: number; // 1 - 10 integer
  weight: number; // Stored for calculation & historical lock, hidden from evaluator UI
  weightedContribution: number; // (score / 10) * weight
  notes?: string;
}

export interface EvaluationAIRecommendations {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  actionPlan: string[];
  generatedAt?: string;
}

export interface SnapshotTemplateConfig {
  version: string;
  minEmploymentMonths: number;
  commonSkillsPercent: number;
  departmentKpiPercent: number;
  tlLeadershipPercent: number;
  headTechManagementPercent: number;
  kpis: KPIDefinition[];
  classifications: PerformanceClassificationConfig[];
}

export interface PerformanceClassificationConfig {
  id: string;
  minScore: number;
  maxScore: number;
  label: string;
  badgeColor: string;
  description: string;
}

export interface Evaluation {
  id: string;
  /** Primary-key value of the persisted Supabase evaluations row. */
  databaseId?: string | number;
  /** Original non-standard details payload retained when importing a legacy row. */
  legacyDetails?: unknown;
  employeeId: string;
  employeeName: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: string;
  departmentId: string;
  departmentName: string;
  role: string;
  level: EmployeeLevel;
  isHeadTechnical?: boolean;
  quarter: EvaluationQuarter;
  year: number;
  cycleId: string;
  version: string;
  status: EvaluationStatus;
  isEligible: boolean;
  tenureMonths: number;
  eligibilityReason?: string;
  
  // Computed scores
  commonScore: number;       // out of 40% (or proportional)
  departmentScore: number;   // out of 60% (or 40% for TL/Head Tech)
  leadershipScore?: number;  // out of 20% for TL / Head Tech
  finalScore: number;        // out of 100%
  classification: string;    // e.g. "Very Good", "Excellent"
  departmentRank: number;
  totalInDepartment: number;

  // Qualitative feedback
  strengths: string;
  improvements: string;
  developmentActions: string;
  aiRecommendations?: EvaluationAIRecommendations;

  // Workflow timestamps & actors
  submittedAt?: string;
  submittedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenedById?: string;
  reopenedByRole?: SystemRole;
  publishedAt?: string;
  publishedBy?: string;
  viewedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgementNotes?: string;

  // Snapshot & locking
  locked: boolean;
  snapshotConfig: SnapshotTemplateConfig;
  scores: EvaluationScoreItem[];

  createdAt: string;
  updatedAt: string;
}

export interface CompanyProfile {
  companyName: string;
  companyLogo: string;
  companyEmail: string;
  systemName: string;
  hrContact: string;
  defaultLanguage: 'ENGLISH' | 'ARABIC';
  updatedAt?: string;
  updatedBy?: string;
}

export interface SetupChecklistItem {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  category: 'PROFILE' | 'ROSTER' | 'STRUCTURE' | 'METRICS' | 'SECURITY';
}

export interface SystemSettings {
  id: string;
  companyProfile?: CompanyProfile;
  evaluationFrequency: 'QUARTERLY';
  activeQuarter: EvaluationQuarter;
  activeYear: number;
  activeVersion: string;
  minEmploymentMonths: number;
  scoreMin: number;
  scoreMax: number;
  commonSkillsPercent: number;
  deptKpiPercent: number;
  tlLeadershipPercent: number;
  headTechManagementPercent: number;
  rankingMethod: 'FINAL_SCORE';
  rankingScope: 'DEPARTMENT';
  acknowledgementEnabled: boolean;
  appealEnabled: boolean;
  classifications: PerformanceClassificationConfig[];
  commonKPIs: KPIDefinition[];
  departmentKPIs: KPIDefinition[];
  leadershipKPIs: KPIDefinition[];
  headTechManagementKPIs: KPIDefinition[];
  levelExpectations: Record<EmployeeLevel, string>;
  updatedAt: string;
  updatedBy: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: SystemRole;
  action: string;
  targetType: 'EVALUATION' | 'SCORE' | 'EMPLOYEE' | 'SETTINGS' | 'USER' | 'ACKNOWLEDGEMENT' | 'SECURITY';
  targetId: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
}

// Added for the Sales/TeleSales module: the actual numbers a Team Leader records for one
// employee in one calendar month. This is what METRIC KPIs are computed from — nothing
// else in the system reads or writes this today. All fields are optional per employee
// because an individual TeleSales agent, a TeleSales Team Leader, a Sales agent and a
// Sales Team Leader each only fill in the subset of metrics that applies to their role.
export interface SalesMonthlyActuals {
  id: string;
  employeeId: string;
  month: number; // 1-12
  year: number;

  // التيلي سيلز (individual)
  dataMeetingsActual?: number;          // اجتماعات الداتا الفعلية
  leadsReceived?: number;               // إجمالي الليدز المستلمة في الشهر
  leadsConvertedToAttendance?: number;  // الليدز اللي حضرت فعليًا خلال 14 يوم
  leadWindowClosesAt?: string;          // ISO date: متى تنتهي مهلة الـ14 يوم لآخر Lead في الشهر
  avgFirstResponseSeconds?: number;     // متوسط سرعة أول رد بالثانية

  // تيم ليدر تيلي سيلز (team aggregate — totals across the whole team, not an average)
  teamMeetingsActual?: number;
  teamLeadsReceived?: number;
  teamLeadsConvertedToAttendance?: number;

  // السيلز (individual)
  grossCollectionInclTax?: number;      // التحصيل المؤهل شامل الضريبة
  refunds?: number;                     // الاسترداد في نفس الشهر
  dealsCount?: number;                  // عدد الصفقات المغلقة (لحساب AOV)
  dealsValueTotal?: number;             // إجمالي قيمة الصفقات (لحساب AOV)

  // تيم ليدر سيلز (own collection uses the same fields above, plus:)
  newHireCollection?: number;           // تحصيل الموظف الجديد اللي بيتابعه

  recordedBy: string;                   // employeeId بتاع التيم ليدر اللي دخل الأرقام
  createdAt: string;
  updatedAt: string;
}

// One computed KPI result for one employee/month, returned by the Sales calculation
// engine (added separately). Kept distinct from EvaluationScoreItem because a METRIC
// result carries N/A and "provisional" states that a manual 1-10 score never has.
export interface SalesMetricResult {
  kpiId: string;
  achieved: number | null;   // null when the metric has no applicable cases this month
  target: number | null;
  isApplicable: boolean;     // false => "غير منطبق" (N/A) — excluded from the total, not scored as 0
  isProvisional: boolean;    // true while the 14-day lead window is still open
  pointsAwarded: number;     // 0 when isApplicable is false
}

export interface DepartmentSummary {
  departmentId: string;
  departmentName: string;
  totalEmployees: number;
  eligibleEmployees: number;
  completedEvaluations: number;
  inProgressEvaluations: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  topPerformerName?: string;
}

export interface AiAnalyticsQueryRequest {
  query: string;
  quarter?: EvaluationQuarter;
  year?: number;
  departmentId?: string;
  employeeId?: string;
}

export interface AiAnalyticsQueryResponse {
  answer: string;
  dataPoints?: Array<{
    label: string;
    value: string | number;
    sublabel?: string;
  }>;
  suggestedFollowUps?: string[];
}
