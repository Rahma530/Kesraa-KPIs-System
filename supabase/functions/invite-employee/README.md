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
The target employee must already have `account_enabled = true`. The request body is
`{ "employeeId": "..." }`; the function reads the email from `public.employees` and
does not accept permissions or an email from the browser.

For a new email, `auth.admin.generateLink({ type: 'invite' })` creates the Auth user
and returns its one-time `action_link` without sending an email. For an existing,
unlinked Auth user, the function returns a recovery action link instead of creating a
duplicate account. The action link verifies with Supabase Auth first, then redirects
to `INVITE_REDIRECT_URL` so the employee can set a password.

The function returns the action link only to the authenticated enabled administrator
who invoked it. The administrator must copy and deliver it manually. Already-linked
employees are returned unchanged and do not receive a replacement link.
