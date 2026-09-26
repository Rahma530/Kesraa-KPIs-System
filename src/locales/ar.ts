// Centralized Arabic Translations and System Dictionary for KESRA Performance Evaluation System

import {
  SystemRole,
  EmployeeLevel,
  EvaluationStatus,
  EvaluationQuarter,
  KPICategory
} from '../types';

export const ARABIC_ROLES: Record<SystemRole, { label: string; desc: string }> = {
  ADMIN: { label: 'System Administrator', desc: 'Full access to settings, KPIs, and data' },
  CEO: { label: 'CEO', desc: 'Approves evaluations and views executive reports' },
  HR: { label: 'HR', desc: 'Manages employee records, approvals, and publishing' },
  HEAD_TECHNICAL: { label: 'Head Technical', desc: 'Evaluates departments, team leaders, and employees' },
  AI_ENGINEER: { label: 'AI Engineer', desc: 'Supports technical evaluation and employee management' },
  TEAM_LEADER: { label: 'Team Leader', desc: 'Reviews and evaluates department employees' },
  EMPLOYEE: { label: 'Employee / Agent', desc: 'Views and acknowledges personal evaluations' },
};

export const ADDITIONAL_PERMISSION_LABELS = {
  ADMIN: { label: 'System Administrator', desc: 'Additional system-management permission' },
} as const;

export const ARABIC_LEVELS: Record<EmployeeLevel, string> = {
  Junior: 'Junior',
  Mid: 'Mid',
  Senior: 'Senior',
  'Team Leader': 'Team Leader',
};

export const ARABIC_STATUSES: Record<EvaluationStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  UNDER_REVIEW: { label: 'Head Of Technical Review', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  APPROVED: { label: 'Approved', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
};

export const ARABIC_QUARTERS: Record<EvaluationQuarter, string> = {
  Q1: 'Quarter 1 (Q1)',
  Q2: 'Quarter 2 (Q2)',
  Q3: 'Quarter 3 (Q3)',
  Q4: 'Quarter 4 (Q4)',
};

export const ARABIC_CATEGORIES: Record<KPICategory, string> = {
  COMMON: 'Common Skills',
  DEPARTMENT: 'Department KPIs',
  LEADERSHIP: 'Leadership and Team Development',
  MANAGEMENT: 'Management and Governance',
};

export const ARABIC_CLASSIFICATIONS: Record<string, { label: string; color: string; desc: string }> = {
  Excellent: {
    label: 'Excellent',
    color: '#10b981',
    desc: 'يتجاوز التوقعات بشكل مستمر مع إتقان استثنائي وقيادة نموذجية.',
  },
  'Very Good': {
    label: 'Very Good',
    color: '#6366f1',
    desc: 'يقدم عملاً عالي الجودة باستمرار مع استقلالية عالية وقدرة ممتازة على حل المشكلات.',
  },
  Good: {
    label: 'Good',
    color: '#f59e0b',
    desc: 'يحقق المتطلبات الأساسية مع أداء ثابت؛ بحاجة لتطوير طفيف في بعض المهارات.',
  },
  'Needs Improvement': {
    label: 'Needs Improvement',
    color: '#f97316',
    desc: 'تذبذب في الأداء أو الالتزام بالمواعيد يستوجب خطة تدريب ومتابعة.',
  },
  'Needs Attention': {
    label: 'Needs Attention',
    color: '#ef4444',
    desc: 'قصور ملحوظ في الأداء يؤثر على مخرجات الفريق ويتطلب تدخلاً عاجلاً.',
  },
};

export const t = {
  appName: 'Kesraa KPIs System',
  companySubtitle: 'Performance management across seven departments',
  cycle: 'Evaluation period:',
  
  // Navigation
  dashboard: 'Dashboard',
  evaluations: 'Evaluation History',
  employees: 'Employees',
  settings: 'KPIs & Settings',
  audit: 'Audit Log',
  
  // Dashboard Metrics
  completionRate: 'Evaluation Completion',
  averageScore: 'Company Average Score',
  pendingApprovals: 'Pending Review',
  aiAnalytics: 'AI Insights',
  activeEvaluations: 'Current Evaluations',
  departmentRankings: 'Department Rankings',
  departmentBenchmarks: 'Department Performance',
  classificationDistribution: 'Performance Distribution',
  auditSnapshot: 'Recent Activity',
  allDepartments: 'All Departments',
  records: 'records',
  
  // Actions
  newEvaluation: 'New Evaluation',
  generateAIInsights: 'AI Insights',
  sheetsSync: 'CSV Import / Export',
  exportBackup: 'Export Backup (JSON)',
  restoreBackup: 'Restore Backup',
  reviewDetails: 'Review Details',
  editScore: 'Edit Evaluation',
  view: 'View Evaluation',
  saveDraft: 'Save as Draft',
  submitToHR: 'Submit To Manager',
  approveEvaluation: 'Approve Evaluation',
  publishToEmployee: 'Publish to Employee',
  acknowledgeScorecard: 'Acknowledge Evaluation',
  addEmployee: 'Add Employee',
  editEmployee: 'Edit Employee',
  deleteEmployee: 'Delete Employee',
  saveChanges: 'Save Changes',
  cancel: 'Cancel',
  close: 'Close',
  search: 'Search by name, role, or department...',
  filterByDepartment: 'Filter by department',
  filterByStatus: 'Filter by status',
  
  // Form & Evaluation Terms
  employee: 'Employee',
  evaluator: 'Evaluator',
  department: 'Department',
  role: 'Role',
  level: 'Level',
  tenure: 'Tenure',
  tenureMonths: 'months',
  eligibilityStatus: 'Evaluation Eligibility',
  eligible: 'Eligible for evaluation',
  ineligible: 'Not yet eligible',
  finalScore: 'Final Score',
  classification: 'Classification',
  rank: 'Department Rank',
  commonSkills: 'Common Skills',
  departmentKpis: 'Department KPIs',
  leadershipSkills: 'Leadership Skills',
  strengths: 'Strengths and Achievements',
  improvements: 'Areas for Improvement',
  developmentPlan: 'Development Plan',
  employeeNotes: 'Employee Notes',
  lockedNotice: 'This evaluation is approved, archived, and locked.',
  weightSumValid: 'KPI weights are valid and total 100%',
  weightSumError: 'KPI weights do not match the required total',
  
  // Placeholders & Helpers
  noRecordsFound: 'No evaluations match the selected filters.',
  noEmployeesFound: 'No employees match your search.',
  select1to10: 'Select a score from 1 to 10',
  scoringGuide: 'Rating guide from 1 to 10',
};
