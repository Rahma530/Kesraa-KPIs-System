-- READ-ONLY checks for the shared settings row ('sys-settings').
-- Run AFTER supabase/migrations/202610010001_seed_settings.sql has been applied.
-- Every statement below is a SELECT; nothing is modified.

-- 1a. KPI counts per part (expected after seeding: 9 common, 56 department, 3 leadership,
--     3 head-tech management, 5 classifications; updated_by = 'seed-from-code').
select
  jsonb_array_length(common_kpis)               as common_kpis,
  jsonb_array_length(department_kpis)           as department_kpis,
  jsonb_array_length(leadership_kpis)           as leadership_kpis,
  jsonb_array_length(head_tech_management_kpis) as head_tech_management_kpis,
  jsonb_array_length(classifications)           as classifications,
  active_version,
  updated_by,
  updated_at
from public.settings
where id = 'sys-settings';

-- 1b. Active weight totals per group, as the app validates them:
--     common = 40; each (department, roleName) group = 60; leadership = 20; head-tech management = 20.
--     Every row must show ok = true.
with s as (
  select * from public.settings where id = 'sys-settings'
),
kpis as (
  select 'common' as part, null::text as department_id, null::text as role_name, k
  from s, jsonb_array_elements(s.common_kpis) k
  union all
  select 'department', coalesce(k->>'departmentId', 'generic'), nullif(btrim(k->>'roleName'), ''), k
  from s, jsonb_array_elements(s.department_kpis) k
  union all
  select 'leadership', null, null, k
  from s, jsonb_array_elements(s.leadership_kpis) k
  union all
  select 'head_tech_management', null, null, k
  from s, jsonb_array_elements(s.head_tech_management_kpis) k
)
select
  part,
  department_id,
  coalesce(role_name, '(all roles)') as role_name,
  count(*) as kpis,
  count(*) filter (where (k->>'isActive')::boolean) as active_kpis,
  coalesce(sum((k->>'weight')::numeric) filter (where (k->>'isActive')::boolean), 0) as active_weight,
  case part when 'common' then 40 when 'department' then 60 else 20 end as expected_weight,
  coalesce(sum((k->>'weight')::numeric) filter (where (k->>'isActive')::boolean), 0)
    = case part when 'common' then 40 when 'department' then 60 else 20 end as ok
from kpis
group by part, department_id, role_name
order by part, department_id, role_name nulls first;

-- 1c. KPI ids that appear more than once across common/department/leadership (expect no rows).
--     (Head-tech management intentionally reuses the leadership KPI ids, so it is excluded.)
select k->>'id' as kpi_id, count(*) as occurrences
from public.settings s,
     jsonb_array_elements(s.common_kpis || s.department_kpis || s.leadership_kpis) k
where s.id = 'sys-settings'
group by 1
having count(*) > 1;

-- 2. Seed vs. real saved evaluations: for evaluations updated since 2026-09-26, compare every
--    snapshotConfig.kpis item (id, weight, category) with the seeded settings and list each
--    difference. No rows = every saved evaluation's KPIs match the seed exactly.
--    details may be stored as a JSON object or as a JSON-encoded string; both are handled.
--    (A details value that is not valid JSON would make this query fail; none is expected.)
with seed as (
  select distinct on (k->>'id')
    k->>'id' as kpi_id,
    (k->>'weight')::numeric as weight,
    k->>'category' as category
  from public.settings s,
       jsonb_array_elements(s.common_kpis || s.department_kpis || s.leadership_kpis || s.head_tech_management_kpis) k
  where s.id = 'sys-settings'
  order by k->>'id'
),
ev as (
  select
    e.id as evaluation_id,
    e.employee_id,
    e.employee_name,
    e.quarter,
    e.evaluation_year,
    coalesce(e.workflow_status, e.status) as status,
    e.updated_at,
    case
      when e.details is null then null
      when jsonb_typeof(e.details::jsonb) = 'string' then (e.details::jsonb #>> '{}')::jsonb
      else e.details::jsonb
    end as d
  from public.evaluations e
  where e.updated_at >= timestamptz '2026-09-26 00:00:00+00'
),
snapshot_kpis as (
  select ev.*, k
  from ev,
       jsonb_array_elements(
         case when jsonb_typeof(ev.d->'snapshotConfig'->'kpis') = 'array'
              then ev.d->'snapshotConfig'->'kpis' else '[]'::jsonb end
       ) k
)
select
  case
    when seed.kpi_id is null then 'KPI id missing from seed'
    when (sk.k->>'weight')::numeric is distinct from seed.weight then 'weight differs'
    else 'category differs'
  end as issue,
  sk.evaluation_id, sk.employee_id, sk.employee_name, sk.quarter, sk.evaluation_year, sk.status, sk.updated_at,
  sk.k->>'id' as kpi_id,
  (sk.k->>'weight')::numeric as snapshot_weight,
  seed.weight as seed_weight,
  sk.k->>'category' as snapshot_category,
  seed.category as seed_category
from snapshot_kpis sk
left join seed on seed.kpi_id = sk.k->>'id'
where seed.kpi_id is null
   or (sk.k->>'weight')::numeric is distinct from seed.weight
   or sk.k->>'category' is distinct from seed.category

union all

-- Evaluations in the same window that have no snapshot KPIs at all (e.g. legacy rows with NULL details).
select
  'no snapshot KPIs' as issue,
  ev.evaluation_id, ev.employee_id, ev.employee_name, ev.quarter, ev.evaluation_year, ev.status, ev.updated_at,
  null, null, null, null, null
from ev
where case
        when jsonb_typeof(ev.d->'snapshotConfig'->'kpis') = 'array'
          then jsonb_array_length(ev.d->'snapshotConfig'->'kpis') = 0
        else true
      end

order by issue, employee_id, evaluation_id;
