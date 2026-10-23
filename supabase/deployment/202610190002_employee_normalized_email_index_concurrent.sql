-- LOCAL DEPLOYMENT DRAFT; not executed by Codex.
-- Apply only after employee_management_production_final_report.sql shows:
--   * zero duplicate normalized-email groups;
--   * no invalid/unready email index;
--   * no incompatible index named employees_normalized_email_key.
-- This file must run as a standalone, non-transactional deployment step.

do $preflight$
declare
  named_index record;
begin
  if exists (
    select 1
    from public.employees
    where email is not null and trim(email) <> ''
    group by lower(trim(email))
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce employee email uniqueness: duplicate normalized emails exist.';
  end if;

  select indexrel.indisunique, indexrel.indisvalid, indexrel.indisready,
         pg_get_indexdef(indexrel.indexrelid) as definition
  into named_index
  from pg_index indexrel
  join pg_class index_class on index_class.oid = indexrel.indexrelid
  join pg_namespace index_schema on index_schema.oid = index_class.relnamespace
  where index_schema.nspname = 'public'
    and index_class.relname = 'employees_normalized_email_key';

  if found and (
    not named_index.indisunique
    or not named_index.indisvalid
    or not named_index.indisready
    or named_index.definition not ilike '%lower%trim%email%'
  ) then
    raise exception 'employees_normalized_email_key exists but is invalid, unready, non-unique, or incompatible.';
  end if;
end
$preflight$;

create unique index concurrently if not exists employees_normalized_email_key
  on public.employees (lower(trim(email)))
  where email is not null and trim(email) <> '';

-- If the concurrent build fails, PostgreSQL may leave an invalid index. Do not retry
-- blindly: inspect pg_index, then use a separately approved DROP INDEX CONCURRENTLY
-- for the exact invalid index before rerunning this step.
