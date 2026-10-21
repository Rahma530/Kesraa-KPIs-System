-- Employee Management authoritative-data contract (LOCAL DRAFT; not applied by Codex).
--
-- This migration is additive and deliberately keeps employment state separate from
-- account access. Existing rows remain employment-unclassified (NULL) until the
-- business owner verifies them. New rows created through the Edge Function are active.

begin;

alter table public.employees
  add column if not exists job_title text null,
  add column if not exists employment_active boolean null,
  add column if not exists employee_version bigint not null default 1;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employees'::regclass
      and conname = 'employees_employee_version_positive'
  ) then
    alter table public.employees
      add constraint employees_employee_version_positive check (employee_version > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employees'::regclass
      and conname = 'employees_system_role_supported'
  ) then
    alter table public.employees
      add constraint employees_system_role_supported check (
        system_role in ('ADMIN', 'HR', 'CEO', 'TEAM_LEADER', 'HEAD_TECHNICAL', 'AI_ENGINEER', 'EMPLOYEE')
      ) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employees'::regclass
      and conname = 'employees_level_supported'
  ) then
    alter table public.employees
      add constraint employees_level_supported check (
        level in ('Junior', 'Mid', 'Senior', 'Team Leader')
      ) not valid;
  end if;
end
$migration$;

-- Browser clients must not mutate employee records directly. The reviewed
-- employee-management Edge Function uses the service role and enforces capabilities.
-- Revoke PUBLIC explicitly: privileges inherited through PUBLIC are not removed by a
-- revoke that names only anon/authenticated.
revoke all on table public.employees from public, anon;
revoke all on table public.employees from authenticated;

-- Table-level revokes do not necessarily remove independently granted column
-- privileges. Remove those grants before restoring the one supported browser access:
-- authenticated users reading their own employee profile through RLS.
do $migration$
declare
  employee_column record;
begin
  for employee_column in
    select attname
    from pg_attribute
    where attrelid = 'public.employees'::regclass
      and attnum > 0
      and not attisdropped
  loop
    execute format(
      'revoke all privileges (%I) on table public.employees from public, anon, authenticated',
      employee_column.attname
    );
  end loop;
end
$migration$;

grant select (
  id,
  name,
  email,
  phone,
  department_id,
  level,
  system_role,
  start_date,
  created_at,
  updated_at,
  account_enabled,
  job_title,
  employment_active
) on table public.employees to authenticated;

alter table public.employees enable row level security;

-- Production evidence identified this permissive roster-wide browser policy.
-- It is no longer required because roster reads use the authorized Edge Function.
drop policy if exists employees_select_authenticated on public.employees;

drop policy if exists employees_read_own_profile on public.employees;
create policy employees_read_own_profile
  on public.employees
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

-- Existing permissive policies are OR-combined. This restrictive policy is ANDed
-- with every permissive SELECT policy, so a legacy broad policy cannot expose another
-- employee through the browser. AuthContext reads the only row admitted by RLS and
-- receives no SELECT privilege on auth_user_id, while
-- service-role Edge Functions retain their intentional RLS bypass.
drop policy if exists employees_restrict_authenticated_to_own_profile on public.employees;
create policy employees_restrict_authenticated_to_own_profile
  on public.employees
  as restrictive
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

commit;

-- Deployment prerequisites:
-- * inspect every existing policy, grant, inherited role, view, and SECURITY DEFINER
--   function; this migration does not delete unknown policies or routines;
-- * prove AuthContext self-profile reads against the actual Production policy set;
-- * apply the separately reviewed deployment step
--   supabase/deployment/202610190002_employee_normalized_email_index_concurrent.sql
--   after its duplicate/index preflight passes. The unique index is deliberately not
--   built in this transaction, so its scan does not extend the ACCESS EXCLUSIVE lock
--   taken by ALTER TABLE.
