import { Department, Employee, Evaluation } from '../types';

export const MANAGERIAL_DEPARTMENT_ID = 'dept-mg';

const ENGLISH_DEPARTMENT_NAMES: Record<string, string> = {
  'dept-am': 'Account Management',
  'dept-mb': 'Media Buying',
  'dept-seo': 'SEO & Web Development',
  'dept-sm': 'Social Media & Content',
  'dept-cr': 'Creative',
  'dept-ai': 'AI & Automation',
  'dept-mg': 'Managerial',
  'dept-sales': 'Sales',
};

export const getEnglishDepartmentName = (departmentId: string, fallback = ''): string =>
  ENGLISH_DEPARTMENT_NAMES[departmentId] || fallback;

export const normalizeDepartment = (department: Department): Department => ({
  ...department,
  name: getEnglishDepartmentName(department.id, department.name),
  ...(department.id === 'dept-ai'
    ? { teamLeaderId: undefined, teamLeaderName: undefined }
    : {}),
});

export const normalizeEmployeeDepartment = (employee: Employee): Employee => ({
  ...employee,
  departmentName: getEnglishDepartmentName(employee.departmentId, employee.departmentName),
});

export const normalizeEvaluationDepartment = (evaluation: Evaluation): Evaluation => ({
  ...evaluation,
  departmentName: getEnglishDepartmentName(evaluation.departmentId, evaluation.departmentName),
});

export type SalesTrack = 'TeleSales' | 'Sales';

// Which of the two Sales-department tracks a (normalized) role string belongs to, or
// null outside dept-sales.
export const getSalesTrack = (role: string): SalesTrack | null => {
  if (/^tele\s*sales/i.test(role)) return 'TeleSales';
  if (/^sales/i.test(role)) return 'Sales';
  return null;
};

// Whether currentUser (a Team Leader, or a department-scoped admin) may manage/view
// the given target employee or evaluation. Outside dept-sales this is exactly the
// department match every Team Leader screen already used. Inside dept-sales it also
// enforces the business's stated hierarchy: Head Of TeleSales (= TeleSales Team
// Leader) only manages التيلي سيلز, while Head Of Sales (= Sales Team Leader) manages
// the whole Sales department, both tracks — so a plain department match would
// wrongly let the TeleSales lead manage Sales agents too.
export const isWithinTeamLeaderScope = (
  currentUser: Pick<Employee, 'departmentId' | 'role'>,
  target: { departmentId: string; role: string }
): boolean => {
  if (target.departmentId !== currentUser.departmentId) return false;
  if (currentUser.departmentId !== 'dept-sales') return true;
  if (getSalesTrack(currentUser.role) === 'Sales') return true;
  return getSalesTrack(currentUser.role) === getSalesTrack(target.role);
};

export const isEvaluableEmployee = (employee: Employee): boolean =>
  employee.departmentId !== MANAGERIAL_DEPARTMENT_ID &&
  !['ADMIN', 'HR', 'CEO'].includes(employee.systemRole);

export const getRoleOptions = (departmentId: string): string[] => {
  switch (departmentId) {
    case 'dept-am':
      return ['Account Manager Team Leader', 'Account Manager Agent'];
    case 'dept-mb':
      return ['Media Buyer Team Leader', 'Media Buyer Agent'];
    case 'dept-sm':
      return ['Social Media Specialist Team Leader', 'Social Media Specialist Agent'];
    case 'dept-cr':
      return ['Graphic Designer', 'Video Editor'];
    case 'dept-ai':
      return ['AI Engineer'];
    case 'dept-seo':
      return ['SEO Team Leader', 'SEO Specialist', 'Web Developer', 'Content Creator'];
    case 'dept-sales':
      return [
        'Sales Manager',
        'TeleSales Team Leader',
        'TeleSales Agent',
        'Sales Team Leader',
        'Sales Agent',
      ];
    default:
      return [];
  }
};

export const getStandardRole = (
  departmentId: string,
  currentRole: string,
  level: Employee['level'],
  systemRole?: Employee['systemRole']
): string => {
  if (
    systemRole === 'HEAD_TECHNICAL' ||
    /head\s*(of)?\s*technical|creative director/i.test(currentRole)
  ) {
    return 'Head Of Technical';
  }

  const isTeamLeader = systemRole === 'TEAM_LEADER' || level === 'Team Leader';
  switch (departmentId) {
    case 'dept-am':
      return isTeamLeader ? 'Account Manager Team Leader' : 'Account Manager Agent';
    case 'dept-mb':
      return isTeamLeader ? 'Media Buyer Team Leader' : 'Media Buyer Agent';
    case 'dept-sm':
      return isTeamLeader
        ? 'Social Media Specialist Team Leader'
        : 'Social Media Specialist Agent';
    case 'dept-cr':
      return /video/i.test(currentRole) ? 'Video Editor' : 'Graphic Designer';
    case 'dept-ai':
      return 'AI Engineer';
    case 'dept-seo':
      return isTeamLeader ? 'SEO Team Leader' : currentRole;
    case 'dept-sales': {
      // Sales Manager sits above both tracks and keeps its own title — it must
      // never be folded down into "Sales Team Leader" just because its level is
      // Team Leader, the same way Head Of Technical is special-cased above.
      if (/sales\s*manager/i.test(currentRole)) return 'Sales Manager';
      // Two tracks inside one department (التيلي سيلز vs السيلز) — inferred from the
      // current role text the same way dept-cr tells a Video Editor from a Graphic
      // Designer above, since Employee has no separate "track" field of its own.
      const isTeleSalesTrack = /tele\s*sales/i.test(currentRole);
      if (isTeleSalesTrack) return isTeamLeader ? 'TeleSales Team Leader' : 'TeleSales Agent';
      return isTeamLeader ? 'Sales Team Leader' : 'Sales Agent';
    }
    default:
      return currentRole;
  }
};

// AI & Automation (dept-ai) has no elevated role of its own: every employee
// there is flattened to EMPLOYEE / at most Senior, with no team-leader
// linkage. This used to except anyone flagged 'AI_ENGINEER' -- that
// exception is removed now that AI_ENGINEER no longer exists as a
// permission tier (it is a job title only, handled by getStandardRole).
export const normalizeEmployeeRole = (employee: Employee): Employee => {
  const isAiEmployee = employee.departmentId === 'dept-ai';
  return {
    ...employee,
    role: getStandardRole(
      employee.departmentId,
      employee.role,
      employee.level,
      employee.systemRole
    ),
    ...(isAiEmployee
      ? {
          level: employee.level === 'Team Leader' ? ('Senior' as const) : employee.level,
          systemRole: 'EMPLOYEE' as const,
          teamLeaderId: undefined,
          teamLeaderName: undefined,
        }
      : {}),
  };
};

export const normalizeEvaluationRole = (evaluation: Evaluation): Evaluation => ({
  ...evaluation,
  role: getStandardRole(
    evaluation.departmentId,
    evaluation.role,
    evaluation.level,
    evaluation.level === 'Team Leader' ? 'TEAM_LEADER' : undefined
  ),
  ...(evaluation.departmentId === 'dept-ai' && evaluation.level === 'Team Leader'
    ? { level: 'Senior' as const }
    : {}),
});
