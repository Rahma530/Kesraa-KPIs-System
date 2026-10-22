-- Remove AI_ENGINEER as a system_role value entirely (explicit business
-- decision, 2026-10-22). It was the only job title that also doubled as a
-- permission tier (mirroring HEAD_TECHNICAL's management/evaluation
-- authority); every other job title (Media Buyer, SEO Specialist, ...) is
-- display-only and never appears in system_role. "AI Engineer" stays as a
-- display-only job title (src/utils/departmentNames.ts), it just no longer
-- exists as a system_role / permission value.
--
-- Preflight verified before writing this migration: zero employees currently
-- have system_role = 'AI_ENGINEER' (confirmed via read-only query on
-- 2026-10-22), so tightening the CHECK constraint is safe.
--
-- This supersedes 202610220001's version of employee_management_mutate,
-- removing 'AI_ENGINEER' from every literal role list in the function
-- (actor_can_manage and both privileged-role checks), not just the
-- actor_can_manage list.

begin;

do $preflight$
declare
  ai_engineer_rows integer;
begin
  if to_regprocedure(
    'public.employee_management_mutate(text,jsonb,bigint,text,boolean)'
  ) is null then
    raise exception 'employee_management_mutate does not exist; apply prior migrations first.';
  end if;

  select count(*) into ai_engineer_rows
  from public.employees
  where system_role::text = 'AI_ENGINEER';

  if ai_engineer_rows > 0 then
    raise exception
      'Refusing to remove AI_ENGINEER: % employee row(s) still use it. Reassign them first.',
      ai_engineer_rows;
  end if;
end
$preflight$;

-- Tighten the system_role CHECK constraint to drop 'AI_ENGINEER' from the
-- allowed list. Kept NOT VALID, matching how this constraint was originally
-- added (202610190001), so this does not force a full-table validation scan.
alter table public.employees drop constraint if exists employees_system_role_supported;
alter table public.employees
  add constraint employees_system_role_supported check (
    system_role in ('ADMIN', 'HR', 'CEO', 'TEAM_LEADER', 'HEAD_TECHNICAL', 'EMPLOYEE')
  ) not valid;

create or replace function public.employee_management_mutate(
  p_action text,
  p_employee jsonb,
  p_expected_version bigint,
  p_actor_employee_id text,
  p_actor_has_admin_permission boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  input_employee public.employees%rowtype;
  actor_employee public.employees%rowtype;
  current_employee public.employees%rowtype;
  changed_employee public.employees%rowtype;
  actor_can_manage boolean;
  actor_is_administrator boolean;
  audit_action text;
  audit_details text;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'EMPLOYEE_MANAGEMENT_TRUSTED_ROLE_REQUIRED';
  end if;
  if nullif(btrim(p_actor_employee_id), '') is null then
    raise exception using errcode = '22023', message = 'EMPLOYEE_MANAGEMENT_ACTOR_REQUIRED';
  end if;
  if jsonb_typeof(p_employee) <> 'object' then
    raise exception using errcode = '22023', message = 'EMPLOYEE_MANAGEMENT_PAYLOAD_REQUIRED';
  end if;

  input_employee := jsonb_populate_record(
    null::public.employees,
    jsonb_build_object(
      'id', p_employee -> 'id',
      'name', p_employee -> 'name',
      'email', p_employee -> 'email',
      'phone', p_employee -> 'phone',
      'department_id', p_employee -> 'department_id',
      'job_title', p_employee -> 'job_title',
      'level', p_employee -> 'level',
      'system_role', p_employee -> 'system_role',
      'start_date', p_employee -> 'start_date',
      'account_enabled', p_employee -> 'account_enabled',
      'employment_active', p_employee -> 'employment_active'
    )
  );

  if input_employee.id is null then
    raise exception using errcode = '22023', message = 'EMPLOYEE_ID_REQUIRED';
  end if;

  select * into actor_employee
  from public.employees
  where id::text = p_actor_employee_id;
  if not found
     or actor_employee.account_enabled is not true
     or actor_employee.employment_active is false then
    raise exception using errcode = '42501', message = 'ENABLED_EMPLOYEE_MANAGER_REQUIRED';
  end if;

  actor_is_administrator := p_actor_has_admin_permission is true;
  actor_can_manage := actor_employee.system_role::text in (
    'ADMIN', 'HR', 'HEAD_TECHNICAL'
  ) or p_actor_has_admin_permission is true;
  if not actor_can_manage then
    raise exception using errcode = '42501', message = 'EMPLOYEE_MANAGEMENT_PERMISSION_REQUIRED';
  end if;

  if p_action = 'create' then
    if not actor_is_administrator
       and input_employee.system_role::text in ('ADMIN', 'HR', 'CEO', 'HEAD_TECHNICAL') then
      raise exception using errcode = '42501', message = 'PRIVILEGED_ROLE_REQUIRES_ADMIN';
    end if;

    insert into public.employees (
      id, name, email, phone, department_id, job_title, level, system_role,
      start_date, employment_active, account_enabled, auth_user_id,
      employee_version, created_at, updated_at
    ) values (
      input_employee.id, input_employee.name, input_employee.email,
      input_employee.phone, input_employee.department_id, input_employee.job_title,
      input_employee.level, input_employee.system_role, input_employee.start_date,
      true, false, null, 1, now(), now()
    )
    returning * into changed_employee;

    audit_action := 'EMPLOYEE_CREATED';
    audit_details := format('Created employee %s.', changed_employee.id::text);

  elsif p_action = 'update' then
    if p_expected_version is null or p_expected_version < 1 then
      raise exception using errcode = '22023', message = 'EMPLOYEE_VERSION_REQUIRED';
    end if;

    select * into current_employee
    from public.employees
    where id = input_employee.id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'EMPLOYEE_NOT_FOUND';
    end if;
    if current_employee.employee_version <> p_expected_version then
      raise exception using errcode = '40001', message = 'EMPLOYEE_VERSION_CONFLICT';
    end if;
    if not actor_is_administrator and (
      current_employee.system_role::text in ('ADMIN', 'HR', 'CEO', 'HEAD_TECHNICAL')
      or input_employee.system_role::text in ('ADMIN', 'HR', 'CEO', 'HEAD_TECHNICAL')
    ) then
      raise exception using errcode = '42501', message = 'PRIVILEGED_EMPLOYEE_REQUIRES_ADMIN';
    end if;
    if current_employee.auth_user_id is not null
       and lower(trim(current_employee.email::text)) <> lower(trim(input_employee.email::text)) then
      raise exception using errcode = '22023', message = 'LINKED_EMPLOYEE_EMAIL_CHANGE_FORBIDDEN';
    end if;
    if current_employee.id::text = p_actor_employee_id
       and current_employee.system_role::text is distinct from input_employee.system_role::text then
      raise exception using errcode = '42501', message = 'SELF_ROLE_CHANGE_FORBIDDEN';
    end if;

    update public.employees
    set name = input_employee.name,
        email = input_employee.email,
        phone = input_employee.phone,
        department_id = input_employee.department_id,
        job_title = input_employee.job_title,
        level = input_employee.level,
        system_role = input_employee.system_role,
        start_date = input_employee.start_date,
        employee_version = p_expected_version + 1,
        updated_at = now()
    where id = input_employee.id
    returning * into changed_employee;

    audit_action := 'EMPLOYEE_UPDATED';
    audit_details := format('Updated employee %s.', changed_employee.id::text);

  elsif p_action = 'set-account-enabled' then
    if not actor_is_administrator then
      raise exception using errcode = '42501', message = 'ACCOUNT_ADMIN_REQUIRED';
    end if;
    if p_expected_version is null or p_expected_version < 1
       or input_employee.account_enabled is null then
      raise exception using errcode = '22023', message = 'EMPLOYEE_STATE_AND_VERSION_REQUIRED';
    end if;

    select * into current_employee
    from public.employees
    where id = input_employee.id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'EMPLOYEE_NOT_FOUND';
    end if;
    if current_employee.employee_version <> p_expected_version then
      raise exception using errcode = '40001', message = 'EMPLOYEE_VERSION_CONFLICT';
    end if;
    if current_employee.id::text = p_actor_employee_id
       and input_employee.account_enabled is false then
      raise exception using errcode = '42501', message = 'SELF_ACCOUNT_DISABLE_FORBIDDEN';
    end if;
    if input_employee.account_enabled is true
       and current_employee.employment_active is false then
      raise exception using errcode = '22023', message = 'INACTIVE_EMPLOYMENT_ACCOUNT_ENABLE_FORBIDDEN';
    end if;

    update public.employees
    set account_enabled = input_employee.account_enabled,
        employee_version = p_expected_version + 1,
        updated_at = now()
    where id = input_employee.id
    returning * into changed_employee;

    audit_action := 'EMPLOYEE_ACCOUNT_ACCESS_CHANGED';
    audit_details := format(
      'Changed account access for employee %s to %s.',
      changed_employee.id::text,
      changed_employee.account_enabled::text
    );

  elsif p_action = 'set-employment-active' then
    if not actor_is_administrator then
      raise exception using errcode = '42501', message = 'ACCOUNT_ADMIN_REQUIRED';
    end if;
    if p_expected_version is null or p_expected_version < 1
       or input_employee.employment_active is null then
      raise exception using errcode = '22023', message = 'EMPLOYEE_STATE_AND_VERSION_REQUIRED';
    end if;

    select * into current_employee
    from public.employees
    where id = input_employee.id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'EMPLOYEE_NOT_FOUND';
    end if;
    if current_employee.employee_version <> p_expected_version then
      raise exception using errcode = '40001', message = 'EMPLOYEE_VERSION_CONFLICT';
    end if;
    if current_employee.id::text = p_actor_employee_id
       and input_employee.employment_active is false then
      raise exception using errcode = '42501', message = 'SELF_EMPLOYMENT_DEACTIVATION_FORBIDDEN';
    end if;

    update public.employees
    set employment_active = input_employee.employment_active,
        account_enabled = case
          when input_employee.employment_active is false then false
          else account_enabled
        end,
        employee_version = p_expected_version + 1,
        updated_at = now()
    where id = input_employee.id
    returning * into changed_employee;

    audit_action := 'EMPLOYEE_EMPLOYMENT_CHANGED';
    audit_details := format(
      'Changed employment state for employee %s to %s%s.',
      changed_employee.id::text,
      changed_employee.employment_active::text,
      case when changed_employee.employment_active is false then ' and disabled account access' else '' end
    );
  else
    raise exception using errcode = '22023', message = 'EMPLOYEE_MANAGEMENT_ACTION_UNSUPPORTED';
  end if;

  insert into public.audit_logs (user_role, user_email, action_type, details)
  values (
    actor_employee.system_role::text,
    coalesce(nullif(actor_employee.email::text, ''), actor_employee.id::text),
    audit_action,
    audit_details
  );

  return (to_jsonb(changed_employee) - 'auth_user_id')
    || jsonb_build_object('auth_linked', changed_employee.auth_user_id is not null);
end
$function$;

revoke all on function public.employee_management_mutate(
  text, jsonb, bigint, text, boolean
) from public, anon, authenticated;

grant execute on function public.employee_management_mutate(
  text, jsonb, bigint, text, boolean
) to service_role;

comment on function public.employee_management_mutate(
  text, jsonb, bigint, text, boolean
) is 'Trusted Edge-only employee mutation with atomic audit logging and optimistic concurrency. Administrator authority: Auth app_metadata only. AI_ENGINEER removed as a system_role value.';

commit;
