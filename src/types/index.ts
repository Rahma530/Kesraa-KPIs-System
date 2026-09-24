export type SystemRole = 'ADMIN' | 'HR' | 'CEO' | 'TEAM_LEADER' | 'HEAD_TECHNICAL' | 'EMPLOYEE';

export type EmployeeLevel = 'Junior' | 'Mid' | 'Senior' | 'Team Leader';

export type EvaluationQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type EvaluationStatus =
  | 'NOT_STARTED'
  | 'DRAFT'
  | 'SUBMITTED_BY_TEAM_LEADER'
  | 'UNDER_REVIEW'
  | 'REVIEWED'
  | 'HR_MANAGEMENT_APPROVED'
  | 'PUBLISHED'
  | 'EMPLOYEE_VIEWED'
  | 'ACKNOWLEDGED';

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
  name: string;
  email: string;
  password?: string;
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
