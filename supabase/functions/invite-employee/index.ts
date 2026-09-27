// @ts-nocheck -- This file runs in Supabase Edge Functions' Deno runtime.
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

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

  let body: { employeeId?: unknown };
  try {
    body = await request.json();
  } catch {
    return response(400, { error: 'A JSON request body is required.' }, allowedOrigin);
  }
  const employeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
  if (!employeeId || employeeId.length > 100) {
    return response(400, { error: 'A valid employeeId is required.' }, allowedOrigin);
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
    return response(409, { error: 'Enable the employee account before generating a setup link.' }, allowedOrigin);
  }
  if (typeof employee.email !== 'string' || !employee.email.includes('@')) {
    return response(422, { error: 'The employee does not have a valid email address.' }, allowedOrigin);
  }

  const normalizedEmail = employee.email.trim().toLowerCase();
  if (employee.auth_user_id) {
    const { data: linkedAuthUser, error: linkedAuthUserError } =
      await adminClient.auth.admin.getUserById(employee.auth_user_id);
    if (linkedAuthUserError || !linkedAuthUser.user) {
      return response(409, { error: 'The linked Auth account could not be found.' }, allowedOrigin);
    }
    if (linkedAuthUser.user.email?.trim().toLowerCase() !== normalizedEmail) {
      return response(409, { error: 'The employee email does not match the linked Auth account.' }, allowedOrigin);
    }

    const { data: recoveryLink, error: recoveryLinkError } =
      await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
        options: { redirectTo: inviteRedirectUrl },
      });
    if (recoveryLinkError || !recoveryLink.properties?.action_link) {
      return response(409, {
        error: recoveryLinkError?.message || 'Could not generate a setup link for the linked Auth account.',
      }, allowedOrigin);
    }

    return response(200, {
      employeeId: employee.id,
      authUserId: linkedAuthUser.user.id,
      alreadyLinked: true,
      invitationLink: recoveryLink.properties.action_link,
      delivery: 'manual',
    }, allowedOrigin);
  }

  let existingAuthUser = null;
  const perPage = 1000;
  for (let page = 1; existingAuthUser === null; page += 1) {
    const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (usersError) {
      return response(500, { error: 'Could not verify whether the employee already has an Auth account.' }, allowedOrigin);
    }
    existingAuthUser = usersPage.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail,
    ) || null;
    if (existingAuthUser || usersPage.users.length < perPage) break;
  }

  if (existingAuthUser) {
    const { data: existingLink, error: existingLinkError } = await adminClient
      .from('employees')
      .select('id')
      .eq('auth_user_id', existingAuthUser.id)
      .maybeSingle();
    if (existingLinkError) {
      return response(500, { error: 'Could not verify the existing Auth account link.' }, allowedOrigin);
    }
    if (existingLink && existingLink.id !== employee.id) {
      return response(409, { error: 'This email is already linked to a different employee profile.' }, allowedOrigin);
    }
    if (existingLink?.id === employee.id) {
      return response(200, {
        employeeId: employee.id,
        authUserId: existingAuthUser.id,
        alreadyLinked: true,
        invitationLink: null,
        delivery: 'manual',
      }, allowedOrigin);
    }
  }

  let authUser = existingAuthUser;
  let actionLink = '';
  let createdAuthUser = false;

  if (existingAuthUser) {
    const { data: recoveryLink, error: recoveryLinkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo: inviteRedirectUrl },
    });
    if (recoveryLinkError || !recoveryLink.properties?.action_link) {
      return response(409, {
        error: recoveryLinkError?.message || 'Could not generate a setup link for the existing Auth account.',
      }, allowedOrigin);
    }
    authUser = recoveryLink.user || existingAuthUser;
    actionLink = recoveryLink.properties.action_link;
  } else {
    const { data: invitation, error: invitationError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: normalizedEmail,
      options: { redirectTo: inviteRedirectUrl },
    });
    if (
      invitationError ||
      !invitation.user ||
      !invitation.properties?.action_link
    ) {
      return response(409, {
        error: invitationError?.message || 'Could not create the Auth user and setup link.',
      }, allowedOrigin);
    }
    authUser = invitation.user;
    actionLink = invitation.properties.action_link;
    createdAuthUser = true;

    const { error: permissionError } = await adminClient.auth.admin.updateUserById(
      authUser.id,
      { app_metadata: { additional_permissions: [] } },
    );
    if (permissionError) {
      await adminClient.auth.admin.deleteUser(authUser.id);
      return response(409, { error: 'The Auth account permissions could not be initialized.' }, allowedOrigin);
    }
  }

  if (!authUser || !actionLink) {
    return response(409, { error: 'Could not prepare the employee setup link.' }, allowedOrigin);
  }

  const { data: linkedEmployee, error: linkError } = await adminClient
    .from('employees')
    .update({ auth_user_id: authUser.id })
    .eq('id', employee.id)
    .is('auth_user_id', null)
    .select('id,auth_user_id')
    .maybeSingle();

  if (linkError || !linkedEmployee) {
    if (createdAuthUser) {
      await adminClient.auth.admin.deleteUser(authUser.id);
    }
    return response(409, { error: 'The Auth account could not be linked to the employee profile.' }, allowedOrigin);
  }

  return response(201, {
    employeeId: linkedEmployee.id,
    authUserId: linkedEmployee.auth_user_id,
    alreadyLinked: false,
    invitationLink: actionLink,
    delivery: 'manual',
  }, allowedOrigin);
});
