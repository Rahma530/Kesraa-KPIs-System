// @ts-nocheck -- This file runs in Supabase Edge Functions' Deno runtime.
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import {
  canReadEvaluationRosterEmployee,
  resolveEvaluationRosterScope,
} from './rosterAuthorization.ts';

const jsonHeaders = { 'Content-Type': 'application/json' };
const MANAGER_ROLES = new Set(['ADMIN', 'HR', 'HEAD_TECHNICAL', 'AI_ENGINEER']);
const PRIVILEGED_ROLES = new Set(['ADMIN', 'HR', 'CEO', 'HEAD_TECHNICAL', 'AI_ENGINEER']);
const SYSTEM_ROLES = new Set([
  'ADMIN', 'HR', 'CEO', 'TEAM_LEADER', 'HEAD_TECHNICAL', 'AI_ENGINEER', 'EMPLOYEE',
]);
const EMPLOYEE_LEVELS = new Set(['Junior', 'Mid', 'Senior', 'Team Leader']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,99}$/;

const respond = (status: number, body: Record<string, unknown>, origin: string) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      ...jsonHeaders,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    },
  },
);

const cleanText = (value: unknown, maximum: number): string =>
  typeof value === 'string' ? value.trim().slice(0, maximum) : '';

const normalizeEmail = (value: unknown): string => cleanText(value, 320).toLowerCase();
const isValidDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const validateEmployee = (input: Record<string, unknown>) => {
  const employee = {
    id: cleanText(input.id, 100),
    name: cleanText(input.name, 200),
    email: normalizeEmail(input.email),
    phone: cleanText(input.phone, 50),
    department_id: cleanText(input.departmentId, 100),
    job_title: cleanText(input.jobTitle, 200),
    level: cleanText(input.level, 50),
    system_role: cleanText(input.systemRole, 50).toUpperCase(),
    start_date: cleanText(input.startDate, 10),
  };
  const errors: string[] = [];
  if (employee.id && !ID_PATTERN.test(employee.id)) errors.push('Employee ID has an invalid format.');
  if (employee.name.length < 2) errors.push('Employee name is required.');
  if (!EMAIL_PATTERN.test(employee.email)) errors.push('Employee email is invalid.');
  if (!employee.department_id) errors.push('Department is required.');
  if (!employee.job_title) errors.push('Job title is required.');
  if (!EMPLOYEE_LEVELS.has(employee.level)) errors.push('Employee level is invalid.');
  if (!SYSTEM_ROLES.has(employee.system_role)) errors.push('System role is invalid.');
  if (!isValidDate(employee.start_date)) {
    errors.push('Start date must be a valid YYYY-MM-DD date.');
  }
  return { employee, errors };
};

const mapEmployee = (row: Record<string, unknown>, departmentNames: Map<string, string>) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone || '',
  departmentId: row.department_id,
  departmentName: departmentNames.get(String(row.department_id)) || row.department_id,
  jobTitle: row.job_title || String(row.system_role || '').replaceAll('_', ' '),
  level: row.level,
  systemRole: row.system_role,
  startDate: row.start_date,
  employmentActive: typeof row.employment_active === 'boolean' ? row.employment_active : null,
  accountEnabled: row.account_enabled === true,
  authLinked: row.auth_linked === true || Boolean(row.auth_user_id),
  version: Number(row.employee_version || 1),
  createdAt: row.created_at || row.start_date,
  updatedAt: row.updated_at || row.created_at || row.start_date,
});

const mapEvaluationEmployee = (
  row: Record<string, unknown>,
  departmentNames: Map<string, string>,
) => ({
  id: row.id,
  name: row.name,
  departmentId: row.department_id,
  departmentName: departmentNames.get(String(row.department_id)) || row.department_id,
  jobTitle: row.job_title || String(row.system_role || '').replaceAll('_', ' '),
  level: row.level,
  systemRole: row.system_role,
  startDate: row.start_date,
});

Deno.serve(async (request) => {
  const allowedOrigin = Deno.env.get('APP_ORIGIN') || 'https://system.kesraa.com';
  const requestOrigin = request.headers.get('origin') || allowedOrigin;
  if (requestOrigin !== allowedOrigin) return respond(403, { error: 'Origin is not allowed.' }, allowedOrigin);
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...jsonHeaders,
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
      },
    });
  }
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' }, allowedOrigin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond(500, { error: 'The employee-management service is not configured.' }, allowedOrigin);
  }
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return respond(401, { error: 'Authentication is required.' }, allowedOrigin);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await callerClient.auth.getUser(
    authorization.slice('Bearer '.length),
  );
  if (authError || !authData.user) {
    return respond(401, { error: 'The authenticated session is invalid.' }, allowedOrigin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller, error: callerError } = await adminClient
    .from('employees')
    .select('id,email,department_id,system_role,account_enabled,employment_active')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();
  if (callerError) return respond(500, { error: 'Could not verify the caller employee profile.' }, allowedOrigin);

  const extraPermissions = Array.isArray(authData.user.app_metadata?.additional_permissions)
    ? authData.user.app_metadata.additional_permissions
    : [];
  // Administrator authority comes exclusively from Auth app_metadata, never from
  // employees.system_role, to stay consistent with Production's audit_logs RLS.
  const isAdministrator = extraPermissions.includes('ADMIN');
  const canManageEmployees = Boolean(caller) && (
    MANAGER_ROLES.has(caller.system_role) || extraPermissions.includes('ADMIN')
  );
  if (!caller || caller.account_enabled !== true || caller.employment_active === false) {
    return respond(403, { error: 'An enabled linked employee account is required.' }, allowedOrigin);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'A JSON request body is required.' }, allowedOrigin);
  }
  const action = cleanText(body.action, 50);

  const loadDepartments = () => adminClient.from('departments').select('id,name').order('name');
  const selectEmployees = () => adminClient.from('employees').select(
    'id,name,email,phone,department_id,job_title,level,system_role,start_date,employment_active,account_enabled,auth_user_id,employee_version,created_at,updated_at',
  );
  const mutateEmployee = async (
    mutationAction: string,
    employeePayload: Record<string, unknown>,
    expectedVersion: number | null,
  ) => adminClient.rpc('employee_management_mutate', {
    p_action: mutationAction,
    p_employee: employeePayload,
    p_expected_version: expectedVersion,
    p_actor_employee_id: caller.id,
    p_actor_has_admin_permission: extraPermissions.includes('ADMIN'),
  });

  const mutationFailure = (
    error: { code?: string; message?: string },
    fallback: string,
    duplicateMessage = 'An employee with this ID or email already exists.',
  ) => {
    if (error.code === '23505') return { status: 409, error: duplicateMessage };
    if (error.code === '40001') {
      return { status: 409, error: 'This employee changed since it was loaded. Refresh and try again.' };
    }
    if (error.code === 'P0002') return { status: 404, error: 'Employee not found.' };
    if (error.code === '42501') return { status: 403, error: 'The employee mutation is not authorized.' };
    const validationMessages: Record<string, string> = {
      EMPLOYEE_VERSION_REQUIRED: 'Employee ID and expected version are required for an update.',
      EMPLOYEE_STATE_AND_VERSION_REQUIRED: 'Employee ID, state, and expected version are required.',
      LINKED_EMPLOYEE_EMAIL_CHANGE_FORBIDDEN: 'A linked employee email cannot be changed until the Auth identity is remediated.',
      INACTIVE_EMPLOYMENT_ACCOUNT_ENABLE_FORBIDDEN: 'Reactivate employment before enabling account access.',
    };
    if (error.code === '22023' && error.message && validationMessages[error.message]) {
      return { status: 422, error: validationMessages[error.message] };
    }
    return { status: 500, error: fallback };
  };

  if (action === 'evaluation-roster') {
    const hasAdministrativeOverride = extraPermissions.includes('ADMIN');
    const rosterScope = resolveEvaluationRosterScope(
      caller.system_role,
      hasAdministrativeOverride,
    );
    if (!rosterScope) {
      return respond(403, { error: 'The employee account cannot access an evaluation roster.' }, allowedOrigin);
    }

    let rosterQuery = adminClient
      .from('employees')
      .select('id,name,department_id,job_title,level,system_role,start_date,employment_active')
      .or('employment_active.is.null,employment_active.eq.true')
      .order('name');

    if (rosterScope === 'department') {
      rosterQuery = rosterQuery.eq('department_id', caller.department_id);
    } else if (rosterScope === 'self') {
      rosterQuery = rosterQuery.eq('id', caller.id);
    }

    const { data: rosterRows, error: rosterError } = await rosterQuery;
    if (rosterError) {
      return respond(500, { error: 'Could not load the authorized evaluation roster.' }, allowedOrigin);
    }

    const visibleRows = (rosterRows || []).filter((employee) =>
      canReadEvaluationRosterEmployee(rosterScope, caller, employee)
    );
    const departmentIds = [...new Set(visibleRows.map((employee) => employee.department_id))];
    const departmentResult = departmentIds.length > 0
      ? await adminClient.from('departments').select('id,name').in('id', departmentIds).order('name')
      : { data: [], error: null };
    if (departmentResult.error) {
      return respond(500, { error: 'Could not load authorized evaluation departments.' }, allowedOrigin);
    }
    const departments = departmentResult.data || [];
    const names = new Map(departments.map((department) => [department.id, department.name]));
    return respond(200, {
      employees: visibleRows.map((employee) => mapEvaluationEmployee(employee, names)),
      departments,
    }, allowedOrigin);
  }

  if (!canManageEmployees) {
    return respond(403, { error: 'Employee-management permission is required.' }, allowedOrigin);
  }

  if (action === 'list') {
    const [employeeResult, departmentResult] = await Promise.all([
      selectEmployees().order('name'),
      loadDepartments(),
    ]);
    if (employeeResult.error) {
      return respond(500, { error: 'Could not load authoritative employee records.' }, allowedOrigin);
    }
    if (departmentResult.error) {
      return respond(500, { error: 'Could not load authoritative departments.' }, allowedOrigin);
    }
    const departments = departmentResult.data || [];
    const names = new Map(departments.map((department) => [department.id, department.name]));
    return respond(200, {
      employees: (employeeResult.data || []).map((employee) => mapEmployee(employee, names)),
      departments,
    }, allowedOrigin);
  }

  const saveOne = async (input: Record<string, unknown>, create: boolean) => {
    const { employee, errors } = validateEmployee(input);
    if (errors.length > 0) return { status: 422, error: errors.join(' ') };
    const { data: department, error: departmentError } = await adminClient
      .from('departments').select('id,name').eq('id', employee.department_id).maybeSingle();
    if (departmentError || !department) return { status: 422, error: 'The selected department does not exist.' };
    if (!isAdministrator && PRIVILEGED_ROLES.has(employee.system_role)) {
      return { status: 403, error: 'Only an administrator can assign this system role.' };
    }

    if (create) {
      const id = employee.id || `emp-${crypto.randomUUID()}`;
      const { data, error } = await mutateEmployee('create', {
        ...employee,
        id,
      }, null);
      if (error) {
        return mutationFailure(error, 'The employee could not be created.');
      }
      if (!data) return { status: 500, error: 'The employee mutation returned no result.' };
      return { status: 201, employee: mapEmployee(data, new Map([[department.id, department.name]])) };
    }

    const expectedVersion = Number(input.expectedVersion);
    if (!employee.id || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return { status: 422, error: 'Employee ID and expected version are required for an update.' };
    }
    const { data: current, error: currentError } = await selectEmployees().eq('id', employee.id).maybeSingle();
    if (currentError) return { status: 500, error: 'Could not load the employee being updated.' };
    if (!current) return { status: 404, error: 'Employee not found.' };
    if (!isAdministrator && PRIVILEGED_ROLES.has(current.system_role)) {
      return { status: 403, error: 'Only an administrator can update this employee.' };
    }
    if (current.auth_user_id && normalizeEmail(current.email) !== employee.email) {
      return { status: 409, error: 'A linked employee email cannot be changed until the Auth identity is remediated.' };
    }
    if (current.id === caller.id && current.system_role !== employee.system_role) {
      return { status: 409, error: 'Administrators cannot change their own system role from Employee Management.' };
    }
    const { data, error } = await mutateEmployee('update', {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      department_id: employee.department_id,
      job_title: employee.job_title,
      level: employee.level,
      system_role: employee.system_role,
      start_date: employee.start_date,
    }, expectedVersion);
    if (error) {
      return mutationFailure(error, 'The employee could not be updated.', 'Another employee already uses this email.');
    }
    if (!data) return { status: 500, error: 'The employee mutation returned no result.' };
    return { status: 200, employee: mapEmployee(data, new Map([[department.id, department.name]])) };
  };

  if (action === 'create' || action === 'update') {
    const input = body.employee && typeof body.employee === 'object' ? body.employee : {};
    const result = await saveOne(input as Record<string, unknown>, action === 'create');
    return respond(result.status, result.error ? { error: result.error } : result, allowedOrigin);
  }

  if (action === 'set-account-enabled' || action === 'set-employment-active') {
    if (!isAdministrator) return respond(403, { error: 'Only an administrator can change access or employment state.' }, allowedOrigin);
    const employeeId = cleanText(body.employeeId, 100);
    const expectedVersion = Number(body.expectedVersion);
    const nextValue = action === 'set-account-enabled' ? body.accountEnabled : body.employmentActive;
    if (!employeeId || typeof nextValue !== 'boolean' || !Number.isInteger(expectedVersion)) {
      return respond(422, { error: 'Employee ID, state, and expected version are required.' }, allowedOrigin);
    }
    if (employeeId === caller.id && nextValue === false) {
      return respond(409, { error: 'Administrators cannot disable or deactivate their own account.' }, allowedOrigin);
    }
    const { data: current, error: currentError } = await selectEmployees().eq('id', employeeId).maybeSingle();
    if (currentError) return respond(500, { error: 'Could not load the target employee.' }, allowedOrigin);
    if (!current) return respond(404, { error: 'Employee not found.' }, allowedOrigin);
    if (action === 'set-account-enabled' && nextValue === true && current.employment_active === false) {
      return respond(409, { error: 'Reactivate employment before enabling account access.' }, allowedOrigin);
    }
    const payload = action === 'set-account-enabled'
      ? { id: employeeId, account_enabled: nextValue }
      : { id: employeeId, employment_active: nextValue };
    const { data, error } = await mutateEmployee(action, payload, expectedVersion);
    if (error) {
      const failure = mutationFailure(error, 'The employee state could not be updated.');
      return respond(failure.status, { error: failure.error }, allowedOrigin);
    }
    if (!data) return respond(500, { error: 'The employee mutation returned no result.' }, allowedOrigin);
    return respond(200, { employee: mapEmployee(data, new Map()) }, allowedOrigin);
  }

  if (action === 'import') {
    if (!isAdministrator) return respond(403, { error: 'Only an administrator can import employees.' }, allowedOrigin);
    if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 250) {
      return respond(422, { error: 'Import requires between 1 and 250 validated rows.' }, allowedOrigin);
    }
    const successful = [];
    const skipped = [];
    const failed = [];
    const seenEmails = new Set<string>();
    const seenIds = new Set<string>();
    const { data: existingEmployees, error: existingEmployeesError } = await adminClient
      .from('employees').select('id,email');
    if (existingEmployeesError) {
      return respond(500, { error: 'Could not check the import for existing employees.' }, allowedOrigin);
    }
    const existingIds = new Set((existingEmployees || []).map((employee) => String(employee.id)));
    const existingEmails = new Set(
      (existingEmployees || []).map((employee) => normalizeEmail(employee.email)),
    );
    for (const rawRow of body.rows) {
      const row = rawRow && typeof rawRow === 'object' ? rawRow as Record<string, unknown> : {};
      const rowNumber = Number(row.rowNumber) || 0;
      const validation = validateEmployee(row);
      if (validation.errors.length > 0) {
        failed.push({ rowNumber, reason: validation.errors.join(' ') });
        continue;
      }
      const email = validation.employee.email;
      const id = validation.employee.id;
      if (seenEmails.has(email) || (id && seenIds.has(id))) {
        skipped.push({ rowNumber, reason: 'Duplicate ID or email within this import.' });
        continue;
      }
      seenEmails.add(email);
      if (id) seenIds.add(id);
      if ((id && existingIds.has(id)) || existingEmails.has(email)) {
        skipped.push({ rowNumber, reason: 'An employee with this ID or email already exists.' });
        continue;
      }
      const result = await saveOne(row, true);
      if (result.employee) {
        successful.push({
          rowNumber,
          employeeId: result.employee.id,
        });
        existingIds.add(result.employee.id);
        existingEmails.add(email);
      }
      else failed.push({ rowNumber, reason: result.error || 'The employee could not be imported.' });
    }
    return respond(200, { successful, skipped, failed }, allowedOrigin);
  }

  return respond(400, { error: 'Unsupported employee-management action.' }, allowedOrigin);
});
