# Employee Management and Reda access production readiness

This document describes the local implementation contract. Nothing in this change
has been applied to Supabase or to an Auth account.

## Verified from repository code

- `ADMIN` is the highest application role and receives every capability.
- Server-managed Auth `app_metadata.additional_permissions = ["ADMIN"]` grants the
  same capability set as an additional permission, but is not required when the
  employee row already has `system_role = 'ADMIN'`.
- Login succeeds only when the Auth user ID matches `employees.auth_user_id`, the
  employee account is enabled, employment is not inactive, and the role/level are
  supported.
- The account setup function accepts either an `ADMIN` employee role or the Auth
  additional permission. It does not treat an employee email as proof that an Auth
  identity exists.
- The old Add/Edit/Delete/CSV implementation changed browser localStorage only.

## Production facts that remain unverified

- The complete current `public.employees` schema and all existing constraints.
- Every existing RLS policy and table grant on employees, departments, and audit logs.
- Whether normalized duplicate employee emails already exist.
- Whether `emp-reda`'s current email is the historical Auth identity.
- Whether a different Auth user already belongs to Reda.
- Whether existing audit-log columns accept the new employee-management event values.

Run `supabase/verification/employee_management_checks.sql` read-only in project
`vvnwcxtfjwgtehofdwuq`. Review results before approving the migration. In the
Supabase Dashboard, also inspect **Authentication → Users** using every verified
historical email for Reda. Do not create a new Auth user until that identity search is
complete.

## Deployment contract and order

1. Run and review the focused read-only report
   `supabase/verification/employee_management_production_final_report.sql`; reconcile
   duplicate emails, effective grants/RLS bypasses, and audit schema conflicts.
2. Approve and apply `202610190001_employee_management_contract.sql`. Existing rows
   intentionally receive `employment_active = NULL`; this means “not yet classified,”
   not inactive. Confirm and classify employment state separately after deployment.
3. Apply the standalone non-transactional deployment step
   `supabase/deployment/202610190002_employee_normalized_email_index_concurrent.sql`,
   then verify the index is valid and ready. Do not deploy employee mutations without
   the normalized-email uniqueness guarantee.
4. Apply `202610190002_employee_management_atomic_rpc.sql`. Confirm the function is
   `SECURITY INVOKER`, only `service_role` has EXECUTE, and a forced audit failure rolls
   back the employee mutation in a non-Production verification environment.
5. Deploy `employee-management` with JWT verification and the existing protected
   service-role environment binding. Confirm `APP_ORIGIN` is the production origin.
6. Deploy the updated `invite-employee` only after the migration, because it checks
   `employment_active`.
7. Deploy the frontend only after both functions are available.
8. Test with a non-admin manager and an administrator. Verify forbidden role changes,
   optimistic-edit conflicts, duplicate imports, deactivation, and account controls.

The migration revokes employee table and column privileges from `PUBLIC` and `anon`,
revokes all employee table and column privileges from `authenticated`, and restores
column-level SELECT only for the fields needed by authenticated self-profile loading.
It does not grant browser access to `auth_user_id`. The repository
has one direct browser employee read: `AuthContext` selects the signed-in employee by
relying on self-profile RLS rather than selecting or filtering on the Auth UUID.
Employee Management roster reads and mutations use the authorized Edge
Function. A restrictive self-profile policy is ANDed with permissive policies, so an
older broad permissive SELECT policy cannot expose other employees through the browser.
The supplied Production evidence identified `employees_select_authenticated USING
(true)`, table/column SELECT over every employee field, and column UPDATE on
`account_enabled`. The migration explicitly drops that policy, revokes all table and
column privileges from browser roles, and grants back only the self-profile columns.
It does not revoke `service_role`; the Edge Functions retain their RLS-bypassing server
access. The restrictive self predicate also prevents another permissive authenticated
policy from reopening roster access accidentally.

## Atomic employee mutation and audit

The supplied Production evidence confirms the four audit payload fields are text, with
UUID/time defaults, no triggers, and only the primary-key constraint. The local
RPC migration now performs each employee mutation and its derived audit insert in one
database transaction. It accepts employee data as JSON and converts it through the
actual `public.employees` row type, avoiding invented parameter types for legacy
employee columns. The Edge Function no longer performs a second audit request or
returns `auditWarning`. Before defining the RPC, the migration fails closed if the
reviewed audit columns/defaults, trigger/constraint set, required employee columns, or
`service_role` employee/audit privileges have drifted.

## Normalized-email index rollout

The chosen plan is concrete: the base migration adds columns and RLS/grant changes in
its transaction, but does not build the email index. After the focused report confirms
zero normalized-email duplicates and no conflicting or invalid email index, run
`supabase/deployment/202610190002_employee_normalized_email_index_concurrent.sql` as a
standalone non-transactional step. It uses `CREATE UNIQUE INDEX CONCURRENTLY`, so the
table scan does not extend the base migration's `ACCESS EXCLUSIVE` lock. Verify
`indisvalid` and `indisready` afterward. A failed concurrent build can leave an invalid
named index; stop and obtain separate approval for an exact `DROP INDEX CONCURRENTLY`
before retrying.

## Safe Reda remediation procedure

The code now consistently treats `system_role = 'ADMIN'` as full administration in
the capability map, route guards, Employee Management UI, account controls, and both
Edge Functions. No Auth metadata override is required for an employee whose verified
database role is already `ADMIN`.

After the deployment prerequisites above and separate Production approval:

1. Confirm the application and Dashboard both target project
   `vvnwcxtfjwgtehofdwuq`.
2. Run the Reda rows in the read-only verification file. Confirm `emp-reda`, its
   intended email, role, account state, link state, and any linked Auth email.
3. Search **Authentication → Users** for the verified current and historical email
   addresses. Confirm ownership with the business owner; email similarity is not
   sufficient evidence.
4. If exactly one legitimate existing Auth identity is found, have an authorized
   operator link that Auth ID to `emp-reda` only after confirming neither side is
   already linked elsewhere. Set the employee's intended `system_role` to `ADMIN`,
   `employment_active` to true, and `account_enabled` to true only with explicit
   account-owner approval. Do not add redundant Auth metadata unless the organization
   separately requires it.
5. If no Auth identity exists, first confirm the authoritative employee email and
   enable the approved employee account. Then an enabled administrator may generate
   one setup link through the existing UI. The function checks Auth for that email,
   avoids duplicate creation, and links atomically.
6. Have Reda complete password setup, sign out, and sign back in. Verify redirect to
   `/admin/dashboard`, access to Employee Management and Settings, and server-side
   authorization for a harmless roster read. Do not validate by changing employee
   data.

If multiple possible Auth identities, duplicate employee rows, mismatched linked
emails, or an existing link to another employee is found, stop and resolve identity
ownership before any linking or account creation.

## Deactivation rule

The former local Delete action was labeled “remove from the active employee list” and
logged as decommissioning. The database workflow therefore implements reversible
deactivation rather than hard deletion:

- retain the employee, Auth link, and evaluation history;
- set `employment_active = false`;
- disable account access in the same server operation;
- require full administrator authority;
- prevent an administrator from deactivating their own record;
- require optimistic `employee_version` matching.

Reactivation changes only employment state. Account access remains a separate,
explicit administrator action.
