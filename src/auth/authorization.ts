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

// A capability granted only through a department-scoped ADMIN permission (see
// AdditionalPermissionScope in types/index.ts) never satisfies this plain,
// department-unaware check — that would silently let a Sales-only admin pass any
// "can you do X" check written before departments existed for ADMIN. Code that must
// work for a scoped admin has to go through hasAuthorizationCapabilityForDepartment
// below and name the department it is checking against.
export const hasAuthorizationCapability = (
  employee: Employee | null | undefined,
  capability: AuthorizationCapability
): boolean => {
  if (!employee) return false;
  if (ROLE_CAPABILITIES[employee.systemRole].includes(capability)) return true;
  if (employee.additionalPermissionScope) return false;
  return (employee.additionalPermissions || []).some((permission) =>
    ADDITIONAL_PERMISSION_CAPABILITIES[permission].includes(capability)
  );
};

// Capabilities a department-scoped ADMIN (e.g. a Sales Admin) may hold within their
// own department. System-wide-only capabilities — audit logs, the executive dashboard,
// global settings, publishing — are intentionally left out: those stay reserved for an
// unscoped ADMIN (today, Head Technical and the CEO), matching "sees and approves only
// their own part, not the whole system."
const DEPARTMENT_SCOPABLE_CAPABILITIES: readonly AuthorizationCapability[] = [
  'MANAGE_EMPLOYEES', 'APPROVE_EVALUATIONS', 'EVALUATE_ALL_EMPLOYEES', 'VIEW_ALL_EVALUATIONS',
];

// Same question as hasAuthorizationCapability, but for one specific department — e.g.
// "can this employee approve evaluations in dept-sales?". An unscoped ADMIN (or any
// systemRole that already grants the capability system-wide) answers true for every
// department, exactly as before. A scoped ADMIN answers true only for their own
// department, and only for a capability in DEPARTMENT_SCOPABLE_CAPABILITIES.
export const hasAuthorizationCapabilityForDepartment = (
  employee: Employee | null | undefined,
  capability: AuthorizationCapability,
  departmentId: string
): boolean => {
  if (!employee) return false;
  if (ROLE_CAPABILITIES[employee.systemRole].includes(capability)) return true;

  const grantsCapability = (employee.additionalPermissions || []).some((permission) =>
    ADDITIONAL_PERMISSION_CAPABILITIES[permission].includes(capability)
  );
  if (!grantsCapability) return false;

  if (!employee.additionalPermissionScope) return true; // unscoped ADMIN: system-wide
  return (
    DEPARTMENT_SCOPABLE_CAPABILITIES.includes(capability) &&
    employee.additionalPermissionScope.departmentId === departmentId
  );
};

export const isTechnicalReviewer = (
  employee: Employee | null | undefined
): boolean => employee?.systemRole === 'HEAD_TECHNICAL';
