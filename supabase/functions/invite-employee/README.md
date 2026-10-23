# Generate employee setup link Edge Function

This function is invoked only when an authorized administrator explicitly generates a setup link.

Required server-side configuration:

- `SUPABASE_URL` (provided by Supabase)
- `SUPABASE_ANON_KEY` (provided by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (provided by Supabase; never expose to the frontend)
- `APP_ORIGIN` (production web origin, for example `https://system.kesraa.com`)
- `INVITE_REDIRECT_URL` (the approved setup-password callback URL)

The caller must have a valid Supabase session mapped to an enabled `ADMIN` employee,
or have the server-managed `ADMIN` additional permission in Supabase Auth `app_metadata`.
The target employee must not be employment-inactive and must already have
`account_enabled = true`. The request body is
`{ "employeeId": "..." }`; the function reads the email from `public.employees` and
does not accept permissions or an email from the browser.

For a new email, `auth.admin.generateLink({ type: 'invite' })` creates the Auth user
and returns its one-time `action_link` without sending an email. For an existing,
unlinked Auth user, the function returns a recovery action link instead of creating a
duplicate account. The action link verifies with Supabase Auth first, then redirects
to `INVITE_REDIRECT_URL` so the employee can set a password.

The function returns the action link and an `authLinked` boolean, never the Auth user
UUID, and only to the authenticated enabled administrator who invoked it. The
administrator must copy and deliver it manually. A linked employee receives a recovery
link after the function verifies that the linked Auth email matches the employee email.
If another request completes the link concurrently, the function returns a safe
`alreadyLinked` response without an Auth identifier or a second setup link.
If a newly created Auth user cannot be linked, the function does not automatically
delete that Auth user: Auth and Postgres cannot share a transaction, and compensating
deletion could remove an identity linked by a concurrent request. A later attempt will
discover the existing email and safely retry the verified link workflow.
