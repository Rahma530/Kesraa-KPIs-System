import {
  AdditionalSystemPermission,
  Employee,
  SystemRole,
} from '../types';

export type AuthorizationCapability =
  | 'MANAGE_SETTINGS'
  | 'MANAGE_EMPLOYEES'
  | 'APPROVE_EVALUATIONS'
  | 'PUBLISH_EVALUATIONS'
  | 'EVALUATE_ALL_EMPLOYEES'
  | 'VIEW_ALL_EVALUATIONS'
  | 'VIEW_KPI_WEIGHTS'
  | 'VIEW_EXECUTIVE_DASHBOARD'
  | 'VIEW_AUDIT_LOGS';

const ROLE_CAPABILITIES: Record<SystemRole, readonly AuthorizationCapability[]> = {
  ADMIN: [
    'MANAGE_SETTINGS', 'MANAGE_EMPLOYEES', 'APPROVE_EVALUATIONS',
    'PUBLISH_EVALUATIONS', 'EVALUATE_ALL_EMPLOYEES', 'VIEW_ALL_EVALUATIONS',
    'VIEW_KPI_WEIGHTS', 'VIEW_EXECUTIVE_DASHBOARD', 'VIEW_AUDIT_LOGS',
  ],
  HR: [
    'MANAGE_SETTINGS', 'MANAGE_EMPLOYEES', 'APPROVE_EVALUATIONS',
    'PUBLISH_EVALUATIONS', 'EVALUATE_ALL_EMPLOYEES', 'VIEW_ALL_EVALUATIONS',
    'VIEW_KPI_WEIGHTS', 'VIEW_EXECUTIVE_DASHBOARD', 'VIEW_AUDIT_LOGS',
  ],
  CEO: [
    'APPROVE_EVALUATIONS', 'EVALUATE_ALL_EMPLOYEES', 'VIEW_ALL_EVALUATIONS',
    'VIEW_KPI_WEIGHTS', 'VIEW_EXECUTIVE_DASHBOARD', 'VIEW_AUDIT_LOGS',
  ],
  HEAD_TECHNICAL: ['MANAGE_EMPLOYEES', 'EVALUATE_ALL_EMPLOYEES', 'VIEW_ALL_EVALUATIONS'],
  TEAM_LEADER: [],
  EMPLOYEE: [],
};

const ADDITIONAL_PERMISSION_CAPABILITIES: Record<
  AdditionalSystemPermission,
  readonly AuthorizationCapability[]
> = { ADMIN: ROLE_CAPABILITIES.ADMIN };

export const VALID_ADDITIONAL_PERMISSIONS: readonly AdditionalSystemPermission[] = ['ADMIN'];

export const hasAdditionalPermission = (
  employee: Employee | null | undefined,
  permission: AdditionalSystemPermission
): boolean => employee?.additionalPermissions?.includes(permission) === true;

// Administrator authority comes exclusively from Supabase Auth app_metadata
// (additional_permissions containing 'ADMIN'), never from employees.system_role.
// This keeps every "is this user an administrator" check consistent with the
// Production audit_logs_select_admin policy, which recognizes only app_metadata.
export const isAccountAdministrator = (
  employee: Employee | null | undefined
): boolean => hasAdditionalPermission(employee, 'ADMIN');

export const hasAuthorizationCapability = (
  employee: Employee | null | undefined,
  capability: AuthorizationCapability
): boolean => {
  if (!employee) return false;
  if (ROLE_CAPABILITIES[employee.systemRole].includes(capability)) return true;
  return (employee.additionalPermissions || []).some((permission) =>
    ADDITIONAL_PERMISSION_CAPABILITIES[permission].includes(capability)
  );
};

export const isTechnicalReviewer = (
  employee: Employee | null | undefined
): boolean => employee?.systemRole === 'HEAD_TECHNICAL';
