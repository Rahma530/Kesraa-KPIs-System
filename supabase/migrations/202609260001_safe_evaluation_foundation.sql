-- Phase 1: Safe Evaluation Database Foundation
-- Additive only. This migration intentionally does not enable RLS, alter grants,
-- create Auth users, rewrite legacy columns, or resolve duplicates/orphans.

begin;

alter table public.employees
  add column if not exists auth_user_id uuid null,
  add column if not exists account_enabled boolean not null default false;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.employees'::regclass
      and conname = 'employees_auth_user_id_key'
  ) then
    alter table public.employees
      add constraint employees_auth_user_id_key unique (auth_user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.employees'::regclass
      and conname = 'employees_auth_user_id_fkey'
  ) then
    alter table public.employees
      add constraint employees_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users (id)
      on delete set null;
  end if;
end
$migration$;

alter table public.evaluations
  add column if not exists quarter text null,
  add column if not exists evaluation_year integer null,
  add column if not exists workflow_status text null,
  add column if not exists updated_at timestamptz null default now(),
  add column if not exists created_by_auth_user_id uuid null,
  add column if not exists updated_by_auth_user_id uuid null,
  add column if not exists is_current boolean not null default true,
  add column if not exists superseded_by uuid null;

-- Preserve public.evaluations.status exactly. Populate only the new workflow column
-- for explicitly known legacy values; NULL and unknown values remain NULL.
update public.evaluations
set workflow_status = case status
  when 'DRAFT' then 'DRAFT'
  when 'UNDER_REVIEW' then 'UNDER_REVIEW'
  when 'SUBMITTED_BY_TEAM_LEADER' then 'UNDER_REVIEW'
  when 'APPROVED' then 'APPROVED'
  when 'REVIEWED' then 'APPROVED'
  when 'HR_MANAGEMENT_APPROVED' then 'APPROVED'
  when 'PUBLISHED' then 'APPROVED'
  when 'EMPLOYEE_VIEWED' then 'APPROVED'
  when 'ACKNOWLEDGED' then 'APPROVED'
  else null
end
where workflow_status is null;

-- Recover period metadata only from explicit values in a supported details payload.
-- Invalid, missing, partial, or ambiguous payloads are left NULL. created_at is never
-- used to infer an evaluation period.
do $migration$
declare
  evaluation_row record;
  parsed_details jsonb;
  candidate_details jsonb;
  quarter_value text;
  year_value text;
begin
  for evaluation_row in
    select id, details
    from public.evaluations
    where details is not null
      and (quarter is null or evaluation_year is null)
  loop
    parsed_details := null;
    candidate_details := null;
    quarter_value := null;
    year_value := null;

    begin
      parsed_details := evaluation_row.details::jsonb;
      if jsonb_typeof(parsed_details) = 'string' then
        parsed_details := (parsed_details #>> '{}')::jsonb;
      end if;
    exception when others then
      parsed_details := null;
    end;

    if jsonb_typeof(parsed_details) = 'object' then
      if parsed_details ? 'quarter' or parsed_details ? 'year' then
        candidate_details := parsed_details;
      elsif jsonb_typeof(parsed_details -> 'evaluation') = 'object' then
        candidate_details := parsed_details -> 'evaluation';
      elsif jsonb_typeof(parsed_details -> 'data') = 'object' then
        candidate_details := parsed_details -> 'data';
      elsif jsonb_typeof(parsed_details -> 'payload') = 'object' then
        candidate_details := parsed_details -> 'payload';
      end if;
    end if;

    if candidate_details is not null then
      quarter_value := candidate_details ->> 'quarter';
      year_value := candidate_details ->> 'year';

      update public.evaluations
      set
        quarter = case
          when quarter is null and quarter_value ~ '^Q[1-4]$' then quarter_value
          else quarter
        end,
        evaluation_year = case
          when evaluation_year is null
            and year_value ~ '^[0-9]{4}$'
            and year_value::integer between 2000 and 2100
          then year_value::integer
          else evaluation_year
        end
      where id = evaluation_row.id;
    end if;
  end loop;
end
$migration$;

commit;

-- Intentionally deferred:
-- * evaluations.employee_id foreign key
-- * workflow_status CHECK / NOT NULL
-- * duplicate canonicalization and unique business-identity index
-- * superseded_by relationship assignment/constraint
-- * RLS, policies, grants, RPCs, Auth users, invitations, or UI changes
