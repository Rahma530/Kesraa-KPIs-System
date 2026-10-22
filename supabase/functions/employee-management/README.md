# Employee management Edge Function

This function is the sole browser-facing persistence boundary for Employee Management.
It requires a valid JWT and resolves the caller from `public.employees` using
`auth_user_id`. The caller must be employment-active (or not yet classified), have
`account_enabled = true`, and have `MANAGE_EMPLOYEES` through `ADMIN`, `HR`,
`HEAD_TECHNICAL`, or server-managed `ADMIN` app metadata. (`AI_ENGINEER` was
removed as a system_role entirely on 2026-10-22 -- it is a job-title label
only now, never a permission tier.)

Supported actions:

- `evaluation-roster`: returns only the non-sensitive fields used by evaluation
  screens. Team Leaders are restricted to their own department on the server;
  technical reviewers receive evaluable employees; ordinary employees receive only
  their own row. The caller must be linked, enabled, and employment-active.
- `list`: returns the authoritative employee roster and departments. It returns
  `authLinked: boolean`, never an Auth UUID, and still requires
  `MANAGE_EMPLOYEES`.
- `create` / `update`: validate known employee fields and use `employee_version`
  for optimistic concurrency. New accounts are always disabled and unlinked.
- `set-account-enabled`: administrator-only. It does not change employment status.
- `set-employment-active`: administrator-only, reversible deactivation. Deactivation
  also disables access but retains the employee row, Auth link, and evaluation history.
- `import`: administrator-only, maximum 250 rows. Existing IDs/emails and duplicate
  rows are skipped; each successful row is confirmed independently and the response
  reports successful, skipped, and failed rows.

Privileged roles (`ADMIN`, `HR`, `CEO`) can only be assigned by an `ADMIN` employee
or a caller with the server-managed `ADMIN` additional permission. Linked employee
emails cannot be changed by this workflow because that would desynchronize Auth.

The function requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, and `APP_ORIGIN`. It must be deployed only after the
employee-management migration is reviewed and applied. Database changes are
authoritative before success is returned.

Employee mutations call `public.employee_management_mutate`, defined in
`202610190002_employee_management_atomic_rpc.sql`. The RPC locks the target employee,
checks `employee_version`, applies the mutation, and inserts the matching `audit_logs`
row in the same transaction. An audit failure therefore rolls back the employee change.
It is `SECURITY INVOKER`, revokes execution from `PUBLIC`, `anon`, and `authenticated`,
and grants execution only to `service_role`; caller authorization remains in this Edge
Function and the RPC repeats the critical administrator/self-protection checks.
