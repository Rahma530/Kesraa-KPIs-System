# Invite employee Edge Function

This function is an account-provisioning foundation. It is not invoked automatically.

Required server-side configuration:

- `SUPABASE_URL` (provided by Supabase)
- `SUPABASE_ANON_KEY` (provided by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (provided by Supabase; never expose to the frontend)
- `APP_ORIGIN` (production web origin, for example `https://system.kesraa.com`)
- `INVITE_REDIRECT_URL` (the approved setup-password callback URL)

The caller must have a valid Supabase session mapped to an enabled `ADMIN` employee,
or have the server-managed `ADMIN` additional permission in Supabase Auth `app_metadata`.
The target employee must already have `account_enabled = true` and no `auth_user_id`.
The request body is `{ "employeeId": "...", "additionalPermissions": [] }`.
The only supported additional permission is `ADMIN`. It is stored in protected Auth
`app_metadata`, not editable user metadata or frontend storage.
