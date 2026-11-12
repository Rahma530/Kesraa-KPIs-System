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
  // MANAGE_SETTINGS and PUBLISH_EVALUATIONS are granted to the CEO job title itself
  // (not only through a separate ADMIN grant) because they are genuinely single,
  // whole-company operations — one settings record, one "publish this cycle" action —
  // with no per-department version of either. Granting them at the systemRole level
  // means they survive department scoping below: whatever departments the CEO's
  // day-to-day evaluation authority is scoped to, these two (and the dashboard/audit/
  // KPI-weights visibility already here) remain whole-company, so the system always
  // has exactly one person who can run them.
  CEO: [
    'MANAGE_SETTINGS', 'PUBLISH_EVALUATIONS',
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

// The capabilities that are genuinely per-department: holding one of these for
// department A says nothing about department B. Everything else (MANAGE_SETTINGS,
// PUBLISH_EVALUATIONS, VIEW_KPI_WEIGHTS, VIEW_EXECUTIVE_DASHBOARD, VIEW_AUDIT_LOGS) is
// a single, whole-company operation or view with no per-department version — the
// settings record, the audit log and the executive dashboard are not split by
// department anywhere else in this app, so scoping them per department would not
// correspond to anything real. Those stay outside this list on purpose.
const DEPARTMENT_SCOPABLE_CAPABILITIES: readonly AuthorizationCapability[] = [
  'MANAGE_EMPLOYEES', 'APPROVE_EVALUATIONS', 'EVALUATE_ALL_EMPLOYEES', 'VIEW_ALL_EVALUATIONS',
];

// Does this employee hold `capability` at all, before any department scoping is
// applied? A capability can come from two independent sources: the systemRole itself
// (e.g. HEAD_TECHNICAL always carries MANAGE_EMPLOYEES), or the separate ADMIN
// additional permission. Returns which source(s) granted it, because the two are
// treated differently once a department scope is involved (see below).
const findsCapabilityGrant = (
  employee: Employee,
  capability: AuthorizationCapability
): { fromRole: boolean; fromAdmin: boolean } => ({
  fromRole: ROLE_CAPABILITIES[employee.systemRole].includes(capability),
  fromAdmin: (employee.additionalPermissions || []).some((permission) =>
    ADDITIONAL_PERMISSION_CAPABILITIES[permission].includes(capability)
  ),
});

// Plain, department-unaware version: "does this employee hold `capability`
// *anywhere*?" Used by UI that is not looking at one particular evaluation/employee
// (e.g. "show the Settings nav link at all"). An employee with a department scope
// answers true here only for a capability their systemRole grants unconditionally
// (see the comment on hasAuthorizationCapabilityForDepartment) — for anything that
// scoping could restrict, this department-unaware check cannot know whether the
// department in play is inside the scope, so it safely answers false. Callers that
// do have a specific department in hand must use hasAuthorizationCapabilityForDepartment
// instead of this one.
export const hasAuthorizationCapability = (
  employee: Employee | null | undefined,
  capability: AuthorizationCapability
): boolean => {
  if (!employee) return false;
  const { fromRole, fromAdmin } = findsCapabilityGrant(employee, capability);
  if (!fromRole && !fromAdmin) return false; // doesn't hold it at all
  if (!employee.additionalPermissionScope) return true; // no scope recorded: system-wide

  // A scope is present. A capability the systemRole grants unconditionally (e.g. the
  // CEO's MANAGE_SETTINGS) is part of the job itself and is never cut down by a
  // department scope — only the per-department operational ones are. See the
  // DEPARTMENT_SCOPABLE_CAPABILITIES comment above for which ones those are.
  if (fromRole && !DEPARTMENT_SCOPABLE_CAPABILITIES.includes(capability)) return true;

  // Everything else — a per-department capability, or one that only the ADMIN grant
  // provided — cannot be confirmed without knowing which department is in play.
  return false;
};

// Same question as hasAuthorizationCapability, but for one specific department — e.g.
// "can this employee approve evaluations in dept-sales?". This is the version every
// evaluation/employee screen should use, because it can actually honor a scope.
export const hasAuthorizationCapabilityForDepartment = (
  employee: Employee | null | undefined,
  capability: AuthorizationCapability,
  departmentId: string
): boolean => {
  if (!employee) return false;
  const { fromRole, fromAdmin } = findsCapabilityGrant(employee, capability);
  if (!fromRole && !fromAdmin) return false; // doesn't hold it at all

  const scope = employee.additionalPermissionScope;
  if (!scope) return true; // no scope recorded: system-wide, exactly as before

  const isScopable = DEPARTMENT_SCOPABLE_CAPABILITIES.includes(capability);

  // Same job-title carve-out as above: a systemRole's whole-company capability (CEO's
  // MANAGE_SETTINGS, VIEW_EXECUTIVE_DASHBOARD, etc.) is unaffected by scoping.
  if (fromRole && !isScopable) return true;

  // A capability that only the ADMIN grant provided, and that is not per-department
  // (VIEW_EXECUTIVE_DASHBOARD, VIEW_AUDIT_LOGS, ...), stays reserved for an *unscoped*
  // ADMIN — a department-scoped admin (Sales Manager, Head Of Sales, or a Technical-
  // scoped Head Technical/CEO) never gets the company-wide views through this grant,
  // matching "sees and approves only their own part, not the whole system."
  if (!isScopable) return false;

  // A genuinely per-department capability: granted only inside the employee's own
  // scoped departments, from either source (role or ADMIN).
  return scope.departmentIds.includes(departmentId);
};

export const isTechnicalReviewer = (
  employee: Employee | null | undefined
): boolean => employee?.systemRole === 'HEAD_TECHNICAL';
