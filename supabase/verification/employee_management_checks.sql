-- READ-ONLY verification queries. Review and run manually in the intended KPIs
-- project before approving the migration/function deployment. These statements do
-- not modify data.

select current_database() as database_name;

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'employees'
order by ordinal_position;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('employees', 'departments', 'audit_logs')
order by tablename, policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('employees', 'departments', 'audit_logs')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select lower(trim(email)) as normalized_email, count(*) as employee_count
from public.employees
where email is not null and trim(email) <> ''
group by lower(trim(email))
having count(*) > 1;

select system_role, count(*) as employee_count
from public.employees
where system_role is null
   or system_role not in ('ADMIN', 'HR', 'CEO', 'TEAM_LEADER', 'HEAD_TECHNICAL', 'EMPLOYEE')
group by system_role;

select level, count(*) as employee_count
from public.employees
where level is null
   or level not in ('Junior', 'Mid', 'Senior', 'Team Leader')
group by level;

select
  id,
  name,
  email,
  department_id,
  level,
  system_role,
  account_enabled,
  auth_user_id is not null as auth_linked
from public.employees
where id = 'emp-reda';

select
  e.id as employee_id,
  e.email as employee_email,
  e.system_role,
  e.account_enabled,
  e.auth_user_id is not null as auth_linked,
  u.email as auth_email,
  u.last_sign_in_at,
  u.raw_app_meta_data -> 'additional_permissions' as additional_permissions
from public.employees e
left join auth.users u on u.id = e.auth_user_id
where e.id = 'emp-reda';

select
  count(*) filter (where employee_id = 'emp-reda') as reda_evaluation_count
from public.evaluations;
