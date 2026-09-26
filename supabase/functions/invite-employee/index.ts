// @ts-nocheck -- This file runs in Supabase Edge Functions' Deno runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };

const response = (status: number, body: Record<string, unknown>, origin: string) => new Response(
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

Deno.serve(async (request) => {
  const allowedOrigin = Deno.env.get('APP_ORIGIN') || 'https://system.kesraa.com';
  const requestOrigin = request.headers.get('origin') || allowedOrigin;
  if (requestOrigin !== allowedOrigin) {
    return response(403, { error: 'Origin is not allowed.' }, allowedOrigin);
  }
  if (request.method === 'OPTIONS') {
    return response(204, {}, allowedOrigin);
  }
  if (request.method !== 'POST') {
    return response(405, { error: 'Method not allowed.' }, allowedOrigin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const inviteRedirectUrl = Deno.env.get('INVITE_REDIRECT_URL');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !inviteRedirectUrl) {
    return response(500, { error: 'The invitation service is not configured.' }, allowedOrigin);
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return response(401, { error: 'Authentication is required.' }, allowedOrigin);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser(token);
  if (callerAuthError || !callerAuth.user) {
    return response(401, { error: 'The authenticated session is invalid.' }, allowedOrigin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('employees')
    .select('id,system_role,account_enabled')
    .eq('auth_user_id', callerAuth.user.id)
    .maybeSingle();
  if (callerProfileError) {
    return response(500, { error: 'Could not verify the caller profile.' }, allowedOrigin);
  }
  const callerAdditionalPermissions = Array.isArray(callerAuth.user.app_metadata?.additional_permissions)
    ? callerAuth.user.app_metadata.additional_permissions
    : [];
  const callerCanAdministerAccounts = callerProfile?.system_role === 'ADMIN' ||
    callerAdditionalPermissions.includes('ADMIN');
  if (!callerProfile || callerProfile.account_enabled !== true || !callerCanAdministerAccounts) {
    return response(403, { error: 'Only an enabled administrator can invite employee accounts.' }, allowedOrigin);
  }

  let body: { employeeId?: unknown; additionalPermissions?: unknown };
  try {
    body = await request.json();
  } catch {
    return response(400, { error: 'A JSON request body is required.' }, allowedOrigin);
  }
  const employeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
  if (!employeeId || employeeId.length > 100) {
    return response(400, { error: 'A valid employeeId is required.' }, allowedOrigin);
  }
  const requestedPermissions = body.additionalPermissions === undefined
    ? []
    : body.additionalPermissions;
  if (
    !Array.isArray(requestedPermissions) ||
    requestedPermissions.some((permission) => permission !== 'ADMIN')
  ) {
    return response(400, { error: 'additionalPermissions contains an unsupported permission.' }, allowedOrigin);
  }

  const { data: employee, error: employeeError } = await adminClient
    .from('employees')
    .select('id,email,auth_user_id,account_enabled')
    .eq('id', employeeId)
    .maybeSingle();
  if (employeeError) {
    return response(500, { error: 'Could not load the target employee.' }, allowedOrigin);
  }
  if (!employee) {
    return response(404, { error: 'Employee not found.' }, allowedOrigin);
  }
  if (employee.account_enabled !== true) {
    return response(409, { error: 'Enable the employee account before sending an invitation.' }, allowedOrigin);
  }
  if (employee.auth_user_id) {
    return response(409, { error: 'This employee is already linked to an Auth account.' }, allowedOrigin);
  }
  if (typeof employee.email !== 'string' || !employee.email.includes('@')) {
    return response(422, { error: 'The employee does not have a valid email address.' }, allowedOrigin);
  }

  const { data: invitation, error: invitationError } = await adminClient.auth.admin.inviteUserByEmail(
    employee.email,
    { redirectTo: inviteRedirectUrl },
  );
  if (invitationError || !invitation.user) {
    return response(409, { error: invitationError?.message || 'Could not create the invitation.' }, allowedOrigin);
  }

  const { error: permissionError } = await adminClient.auth.admin.updateUserById(
    invitation.user.id,
    { app_metadata: { additional_permissions: requestedPermissions } },
  );
  if (permissionError) {
    await adminClient.auth.admin.deleteUser(invitation.user.id);
    return response(409, { error: 'The invitation permissions could not be configured.' }, allowedOrigin);
  }

  const { data: linkedEmployee, error: linkError } = await adminClient
    .from('employees')
    .update({ auth_user_id: invitation.user.id })
    .eq('id', employee.id)
    .is('auth_user_id', null)
    .select('id,auth_user_id')
    .maybeSingle();

  if (linkError || !linkedEmployee) {
    await adminClient.auth.admin.deleteUser(invitation.user.id);
    return response(409, { error: 'The invitation could not be linked to the employee profile.' }, allowedOrigin);
  }

  return response(201, {
    employeeId: linkedEmployee.id,
    authUserId: linkedEmployee.auth_user_id,
    invitationSent: true,
  }, allowedOrigin);
});
