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
  if (systemRole === 'AI_ENGINEER') {
    return 'AI Engineer';
  }
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
    default:
      return currentRole;
  }
};

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
    ...(isAiEmployee && employee.systemRole !== 'AI_ENGINEER'
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
