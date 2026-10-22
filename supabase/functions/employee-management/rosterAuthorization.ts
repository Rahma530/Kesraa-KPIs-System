export type EvaluationRosterScope = 'all' | 'evaluable' | 'department' | 'self';

interface RosterCaller {
  id: string;
  department_id: string;
  system_role: string;
}

interface RosterEmployee {
  id: string;
  department_id: string;
  system_role: string;
  employment_active?: boolean | null;
}

export const resolveEvaluationRosterScope = (
  systemRole: string,
  hasAdministrativeOverride: boolean,
): EvaluationRosterScope | null => {
  if (hasAdministrativeOverride || ['ADMIN', 'HR', 'CEO'].includes(systemRole)) return 'all';
  if (systemRole === 'HEAD_TECHNICAL') return 'evaluable';
  if (systemRole === 'TEAM_LEADER') return 'department';
  if (systemRole === 'EMPLOYEE') return 'self';
  return null;
};

export const canReadEvaluationRosterEmployee = (
  scope: EvaluationRosterScope,
  caller: RosterCaller,
  employee: RosterEmployee,
): boolean => {
  if (employee.employment_active === false) return false;
  if (scope === 'all') return true;
  if (scope === 'self') return employee.id === caller.id;
  if (scope === 'department') return employee.department_id === caller.department_id;
  return employee.department_id !== 'dept-mg' &&
    !['ADMIN', 'HR', 'CEO'].includes(employee.system_role);
};
