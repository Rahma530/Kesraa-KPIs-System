-- Kesraa KPIs System: focused Employee Management Production decision report.
-- Run manually in the SQL Editor for project vvnwcxtfjwgtehofdwuq.
-- Catalog inspection and SELECT statements only. Returns one JSONB value and no Auth UUIDs.

begin transaction read only;

do $report$
declare
  result jsonb := jsonb_build_object(
    'report', 'employee_management_production_decision_report',
    'expected_project_ref', 'vvnwcxtfjwgtehofdwuq',
    'project_check', 'Confirm the Dashboard URL project reference; current_database() alone cannot identify a Supabase project.'
  );
  section jsonb;
  employees_exists boolean := to_regclass('public.employees') is not null;
  audit_logs_exists boolean := to_regclass('public.audit_logs') is not null;
  employee_email_exists boolean := false;
  duplicate_email_groups bigint := null;
  required_audit_columns_found integer := null;
  service_role_audit_insert boolean := null;
  compatible_email_index_count integer := null;
  invalid_email_index_count integer := null;
  named_email_index_conflict boolean := null;
begin
  result := result || jsonb_build_object(
    'context', jsonb_build_object(
      'database_name', current_database(),
      'executing_role', current_user,
      'transaction_read_only', current_setting('transaction_read_only'),
      'inspected_at_utc', timezone('UTC', clock_timestamp()),
      'employees_visible', employees_exists,
      'audit_logs_visible', audit_logs_exists
    )
  );

  -- Effective employee privileges, including direct PUBLIC grants and inherited roles.
  if employees_exists then
    begin
      select coalesce(jsonb_agg(to_jsonb(x) order by x.grantee, x.privilege_type), '[]'::jsonb)
      into section
      from (
        select grantee, privilege_type, is_grantable
        from information_schema.table_privileges
        where table_schema = 'public' and table_name = 'employees'
      ) x;
      result := result || jsonb_build_object('employees_table_grants', section);

      select coalesce(jsonb_agg(to_jsonb(x) order by x.grantee, x.column_name, x.privilege_type), '[]'::jsonb)
      into section
      from (
        select grantee, column_name, privilege_type, is_grantable
        from information_schema.column_privileges
        where table_schema = 'public' and table_name = 'employees'
      ) x;
      result := result || jsonb_build_object('employees_column_grants', section);

      select coalesce(jsonb_agg(to_jsonb(x) order by x.role_name, x.privilege), '[]'::jsonb)
      into section
      from (
        select roles.role_name, privileges.privilege,
               case
                 when exists (select 1 from pg_roles where rolname = roles.role_name)
                   then has_table_privilege(roles.role_name, 'public.employees', privileges.privilege)
                 else null
               end as effective
        from (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
        cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) privileges(privilege)
      ) x;
      result := result || jsonb_build_object('employees_effective_table_privileges', section);

      select coalesce(jsonb_agg(to_jsonb(x) order by x.role_name, x.ordinal_position), '[]'::jsonb)
      into section
      from (
        select roles.role_name, cols.ordinal_position, cols.column_name,
               case
                 when exists (select 1 from pg_roles where rolname = roles.role_name)
                   then has_column_privilege(roles.role_name, 'public.employees', cols.column_name, 'SELECT')
                 else null
               end as effective_select
        from (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
        cross join information_schema.columns cols
        where cols.table_schema = 'public' and cols.table_name = 'employees'
      ) x;
      result := result || jsonb_build_object('employees_effective_column_select', section);
    exception when others then
      result := result || jsonb_build_object(
        'employees_privileges', jsonb_build_object('status', 'NOT_CHECKED', 'reason', SQLSTATE || ': ' || SQLERRM)
      );
    end;
  else
    result := result || jsonb_build_object(
      'employees_privileges', jsonb_build_object('status', 'NOT_CHECKED', 'reason', 'public.employees is absent or not visible.')
    );
  end if;

  -- Role membership is recursive because inherited BYPASSRLS or superuser status changes the RLS conclusion.
  begin
    with recursive role_closure as (
      select seed.rolname as login_role, seed.oid as inherited_oid, array[seed.oid] as path
      from pg_roles seed
      where seed.rolname in ('anon', 'authenticated', 'service_role')
      union all
      select closure.login_role, membership.roleid, closure.path || membership.roleid
      from role_closure closure
      join pg_auth_members membership on membership.member = closure.inherited_oid
      where not membership.roleid = any(closure.path)
    )
    select coalesce(jsonb_agg(to_jsonb(x) order by x.login_role, x.inherited_role), '[]'::jsonb)
    into section
    from (
      select closure.login_role, inherited.rolname as inherited_role,
             inherited.rolsuper, inherited.rolbypassrls, inherited.rolinherit,
             inherited.rolcanlogin
      from role_closure closure
      join pg_roles inherited on inherited.oid = closure.inherited_oid
    ) x;
    result := result || jsonb_build_object('relevant_role_inheritance', section);
  exception when others then
    result := result || jsonb_build_object(
      'relevant_role_inheritance', jsonb_build_object('status', 'NOT_CHECKED', 'reason', SQLSTATE || ': ' || SQLERRM)
    );
  end;

  -- RLS state and predicates must be reviewed separately from SQL grants.
  begin
    select coalesce(jsonb_agg(to_jsonb(x) order by x.table_name, x.policy_name), '[]'::jsonb)
    into section
    from (
      select cls.relname as table_name, pg_get_userbyid(cls.relowner) as owner_name,
             cls.relrowsecurity as rls_enabled, cls.relforcerowsecurity as force_rls,
             policies.policyname as policy_name, policies.permissive, policies.roles,
             policies.cmd, policies.qual as using_expression,
             policies.with_check as with_check_expression
      from pg_class cls
      join pg_namespace ns on ns.oid = cls.relnamespace
      left join pg_policies policies
        on policies.schemaname = ns.nspname and policies.tablename = cls.relname
      where ns.nspname = 'public' and cls.relname in ('employees', 'audit_logs')
    ) x;
    result := result || jsonb_build_object('rls_state_and_policies', section);
  exception when others then
    result := result || jsonb_build_object(
      'rls_state_and_policies', jsonb_build_object('status', 'NOT_CHECKED', 'reason', SQLSTATE || ': ' || SQLERRM)
    );
  end;

  -- Only SECURITY DEFINER routines whose visible source references the relevant tables.
  begin
    with relevant as (
      select proc.oid, proc.proowner, proc.proacl,
             ns.nspname as function_schema, proc.proname as function_name,
             pg_get_function_identity_arguments(proc.oid) as identity_arguments,
             pg_get_userbyid(proc.proowner) as owner_name,
             proc.prosecdef as security_definer,
             pg_get_functiondef(proc.oid) as definition
      from pg_proc proc
      join pg_namespace ns on ns.oid = proc.pronamespace
      where proc.prosecdef
        and proc.prokind in ('f', 'p')
        and ns.nspname not in ('pg_catalog', 'information_schema')
    ), matched as (
      select * from relevant
      where definition ilike '%employees%' or definition ilike '%audit_logs%'
    ), grants as (
      select matched.oid, coalesce(role_name.rolname, 'PUBLIC') as grantee,
             acl.privilege_type, acl.is_grantable
      from matched
      cross join lateral aclexplode(coalesce(matched.proacl, acldefault('f', matched.proowner))) acl
      left join pg_roles role_name on role_name.oid = acl.grantee
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'schema', matched.function_schema,
      'name', matched.function_name,
      'identity_arguments', matched.identity_arguments,
      'owner', matched.owner_name,
      'security_definer', matched.security_definer,
      'execute_grants', coalesce((
        select jsonb_agg(jsonb_build_object(
          'grantee', grants.grantee,
          'privilege', grants.privilege_type,
          'is_grantable', grants.is_grantable
        ) order by grants.grantee)
        from grants where grants.oid = matched.oid
      ), '[]'::jsonb)
    ) order by matched.function_schema, matched.function_name), '[]'::jsonb)
    into section
    from matched;
    result := result || jsonb_build_object(
      'relevant_security_definer_routines', jsonb_build_object(
        'items', section,
        'limitation', 'Visible function source is text-matched; dynamically constructed object names require manual review.'
      )
    );
  exception when others then
    result := result || jsonb_build_object(
      'relevant_security_definer_routines', jsonb_build_object('status', 'NOT_CHECKED', 'reason', SQLSTATE || ': ' || SQLERRM)
    );
  end;

  -- Evidence required before defining a transactional employee-mutation/audit RPC.
  if audit_logs_exists then
    begin
      select coalesce(jsonb_agg(to_jsonb(x) order by x.ordinal_position), '[]'::jsonb)
      into section
      from (
        select ordinal_position, column_name, data_type, udt_schema, udt_name,
               is_nullable, column_default, is_identity, is_generated
        from information_schema.columns
        where table_schema = 'public' and table_name = 'audit_logs'
      ) x;
      result := result || jsonb_build_object('audit_logs_columns', section);

      select coalesce(jsonb_agg(to_jsonb(x) order by x.column_name, x.enum_sort_order), '[]'::jsonb)
      into section
      from (
        select cols.column_name, enum_values.enumsortorder as enum_sort_order,
               enum_values.enumlabel as enum_value
        from information_schema.columns cols
        join pg_namespace type_schema on type_schema.nspname = cols.udt_schema
        join pg_type types
          on types.typname = cols.udt_name
         and types.typnamespace = type_schema.oid
        join pg_enum enum_values on enum_values.enumtypid = types.oid
        where cols.table_schema = 'public' and cols.table_name = 'audit_logs'
      ) x;
      result := result || jsonb_build_object('audit_logs_enum_values', section);

      select count(*) into required_audit_columns_found
      from information_schema.columns
      where table_schema = 'public' and table_name = 'audit_logs'
        and column_name in ('user_role', 'user_email', 'action_type', 'details');

      select coalesce(jsonb_agg(to_jsonb(x) order by x.constraint_name), '[]'::jsonb)
      into section
      from (
        select con.conname as constraint_name, con.contype as constraint_type,
               con.convalidated as validated, pg_get_constraintdef(con.oid, true) as definition
        from pg_constraint con
        where con.conrelid = 'public.audit_logs'::regclass
      ) x;
      result := result || jsonb_build_object('audit_logs_constraints', section);

      select coalesce(jsonb_agg(to_jsonb(x) order by x.trigger_name), '[]'::jsonb)
      into section
      from (
        select trg.tgname as trigger_name, pg_get_triggerdef(trg.oid, true) as definition,
               proc.prosecdef as function_security_definer
        from pg_trigger trg
        join pg_proc proc on proc.oid = trg.tgfoid
        where trg.tgrelid = 'public.audit_logs'::regclass and not trg.tgisinternal
      ) x;
      result := result || jsonb_build_object('audit_logs_triggers', section);

      service_role_audit_insert := case
        when exists (select 1 from pg_roles where rolname = 'service_role')
          then has_table_privilege('service_role', 'public.audit_logs', 'INSERT')
        else null
      end;
      result := result || jsonb_build_object(
        'audit_rpc_prerequisites', jsonb_build_object(
          'required_columns_found', required_audit_columns_found,
          'required_columns_expected', 4,
          'service_role_effective_insert', service_role_audit_insert,
          'proposed_action_values', jsonb_build_array(
            'EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED',
            'EMPLOYEE_ACCOUNT_ACCESS_CHANGED', 'EMPLOYEE_EMPLOYMENT_CHANGED'
          ),
          'decision_rule', 'Column types/defaults/nullability and every CHECK, FK, enum, trigger, and RLS/grant result must support the proposed values before drafting the atomic RPC.'
        )
      );
    exception when others then
      result := result || jsonb_build_object(
        'audit_rpc_prerequisites', jsonb_build_object('status', 'NOT_CHECKED', 'reason', SQLSTATE || ': ' || SQLERRM)
      );
      required_audit_columns_found := null;
      service_role_audit_insert := null;
    end;
  else
    result := result || jsonb_build_object(
      'audit_rpc_prerequisites', jsonb_build_object('status', 'NOT_CHECKED', 'reason', 'public.audit_logs is absent or not visible.')
    );
  end if;

  -- Evidence for a normalized-email unique index and its deployment window.
  if employees_exists then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'employees' and column_name = 'email'
    ) into employee_email_exists;
  end if;

  if employees_exists and employee_email_exists then
    begin
      execute $sql$
        select count(*)
        from (
          select lower(trim(email))
          from public.employees
          where email is not null and trim(email) <> ''
          group by lower(trim(email))
          having count(*) > 1
        ) duplicates
      $sql$ into duplicate_email_groups;

      select count(*) filter (
               where indexrel.indisvalid and indexrel.indisready
                 and indexrel.indisunique
                 and pg_get_indexdef(indexrel.indexrelid) ilike '%lower%trim%email%'
             ),
             count(*) filter (where not indexrel.indisvalid or not indexrel.indisready)
      into compatible_email_index_count, invalid_email_index_count
      from pg_index indexrel
      where indexrel.indrelid = 'public.employees'::regclass
        and pg_get_indexdef(indexrel.indexrelid) ilike '%email%';

      select coalesce(jsonb_agg(to_jsonb(x) order by x.index_name), '[]'::jsonb)
      into section
      from (
        select index_class.relname as index_name, indexrel.indisunique,
               indexrel.indisvalid, indexrel.indisready,
               pg_get_indexdef(indexrel.indexrelid) as definition
        from pg_index indexrel
        join pg_class index_class on index_class.oid = indexrel.indexrelid
        where indexrel.indrelid = 'public.employees'::regclass
          and pg_get_indexdef(indexrel.indexrelid) ilike '%email%'
      ) x;
      result := result || jsonb_build_object('employees_email_indexes', section);

      select coalesce(bool_or(
        not indexrel.indisunique
        or not indexrel.indisvalid
        or not indexrel.indisready
        or pg_get_indexdef(indexrel.indexrelid) not ilike '%lower%trim%email%'
      ), false)
      into named_email_index_conflict
      from pg_index indexrel
      join pg_class index_class on index_class.oid = indexrel.indexrelid
      join pg_namespace index_schema on index_schema.oid = index_class.relnamespace
      where index_schema.nspname = 'public'
        and index_class.relname = 'employees_normalized_email_key';

      select jsonb_build_object(
        'duplicate_normalized_email_groups', duplicate_email_groups,
        'compatible_valid_index_count', compatible_email_index_count,
        'invalid_or_unready_email_index_count', invalid_email_index_count,
        'named_index_conflict', named_email_index_conflict,
        'relation', jsonb_build_object(
          'estimated_rows', cls.reltuples::bigint,
          'table_bytes', pg_relation_size(cls.oid),
          'total_bytes', pg_total_relation_size(cls.oid),
          'n_live_tup', stats.n_live_tup,
          'n_dead_tup', stats.n_dead_tup,
          'n_tup_ins', stats.n_tup_ins,
          'n_tup_upd', stats.n_tup_upd,
          'n_tup_del', stats.n_tup_del,
          'stats_note', 'n_tup_* values are cumulative statistics, not a current write-rate measurement.'
        ),
        'current_lock_snapshot', coalesce((
          select jsonb_agg(to_jsonb(lock_summary) order by lock_summary.mode, lock_summary.granted)
          from (
            select locks.mode, locks.granted, count(*) as session_count
            from pg_locks locks
            where locks.relation = cls.oid and locks.pid <> pg_backend_pid()
            group by locks.mode, locks.granted
          ) lock_summary
        ), '[]'::jsonb),
        'lock_snapshot_note', 'A point-in-time empty result does not prove that a deployment window is safe.'
      ) into section
      from pg_class cls
      left join pg_stat_user_tables stats on stats.relid = cls.oid
      where cls.oid = 'public.employees'::regclass;
      result := result || jsonb_build_object('normalized_email_index_prerequisites', section);
    exception when others then
      result := result || jsonb_build_object(
        'normalized_email_index_prerequisites', jsonb_build_object('status', 'NOT_CHECKED', 'reason', SQLSTATE || ': ' || SQLERRM)
      );
      duplicate_email_groups := null;
      compatible_email_index_count := null;
      invalid_email_index_count := null;
      named_email_index_conflict := null;
    end;
  else
    result := result || jsonb_build_object(
      'normalized_email_index_prerequisites', jsonb_build_object('status', 'NOT_CHECKED', 'reason', 'public.employees.email is absent or not visible.')
    );
  end if;

  result := result || jsonb_build_object(
    'DECISION', jsonb_build_object(
      'audit_atomicity', case
        when required_audit_columns_found = 4 and service_role_audit_insert is true
          then 'SCHEMA_EVIDENCE_AVAILABLE_FOR_RPC_DESIGN_REVIEW'
        when required_audit_columns_found is null or service_role_audit_insert is null
          then 'NOT_CHECKED'
        else 'BLOCKER'
      end,
      'normalized_email_index', case
        when duplicate_email_groups = 0
          and coalesce(invalid_email_index_count, 0) = 0
          and named_email_index_conflict is false
          then 'DATA_PREFLIGHT_PASS_REVIEW_SIZE_AND_LOCK_WINDOW'
        when duplicate_email_groups is null then 'NOT_CHECKED'
        else 'BLOCKER'
      end,
      'required_human_review', jsonb_build_array(
        'Confirm authenticated has only intended self-profile columns and no inherited BYPASSRLS/superuser path.',
        'Review every employees RLS predicate and relevant SECURITY DEFINER execute grant.',
        'Confirm audit_logs types, constraints, triggers, RLS, and service_role INSERT support the proposed audit events.',
        'Build the normalized-email unique index concurrently in its separate non-transactional deployment step after duplicate and invalid-index checks pass.'
      ),
      'production_fixed', false
    )
  );

  perform set_config('kesraa.employee_management_decision_report', result::text, true);
exception when others then
  result := result || jsonb_build_object(
    'DECISION', jsonb_build_object(
      'status', 'NOT_CHECKED',
      'reason', SQLSTATE || ': ' || SQLERRM,
      'production_fixed', false
    )
  );
  perform set_config('kesraa.employee_management_decision_report', result::text, true);
end
$report$;

select current_setting('kesraa.employee_management_decision_report')::jsonb
  as employee_management_production_decision_report;

commit;
