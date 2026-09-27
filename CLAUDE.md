# CLAUDE.md — Kesraa KPI / Performance System

## ⚠️ PROJECT ISOLATION — READ FIRST

This repository is **Kesraa KPI / Performance System** ONLY.

It is completely separate from **Agency-Management-System** (different repo, database, deployment, codebase).

- Never open, read, modify, or draw conclusions from any path, file, repo, or Supabase project belonging to Agency-Management-System.
- If any path, git remote, env value, MCP server, Supabase ref, or file content appears to belong to the other project: **STOP immediately and report it. Do not modify anything.**
- Never request access to files outside this repository's root.

## Project identity

| Item | Value |
|---|---|
| Local path | `E:\Kesraa-KPIs-System\Kesraa-KPIs-System-updated\perf-system-final` |
| GitHub | `Rahma530/Kesraa-KPIs-System` |
| Production | `https://system.kesraa.com` |
| Supabase project ref | `vvnwcxtfjwgtehofdwuq` |
| Stack | React, Vite, TypeScript, Supabase Auth + Database, GitHub Actions, Hostinger |
| Deploy flow | `main` → GitHub Actions → build → Hostinger |

## Start-of-session check (every session, before any change)

1. Confirm current working directory is the local path above.
2. `git remote -v` must point to `Rahma530/Kesraa-KPIs-System`.
3. `git status` and `git log --oneline -15`.
4. If anything does not match → STOP and report.

## Completed work — do not undo

- Evaluation workflow + persistence — `9912de3b3a6d10b12a15fa0f73172d043450447a`
- Phase 1 migration (applied manually): `supabase/migrations/202609260001_safe_evaluation_foundation.sql`
- Supabase Auth + separated authorization — `7bca72d`
- Invite/recovery/forgot-password fixes — `77ccf50b20371b564ad4404cfa4bcd317fc556b6`, `56731ac32dec14cd7649e473c1d61f375a1d525f`
- Manual employee setup links — `b88fd83416dc794602321ed9104546508d9ef938`
- Invite CORS preflight fix — `7d360de769aec1d2cdfbc6a2acb7a6ca1a5b2ad4`
- Admin account enable/disable controls — `4c681ba`
- `invite-employee` v6 (generate setup link; email read from `public.employees`; no permissions or email accepted from the browser; recovery link for existing unlinked Auth users; ADMIN is set only in Auth `app_metadata`, never via invite)

## Auth design

- `systemRole` = business role only.
- Sensitive permissions (including ADMIN) come from Supabase Auth `app_metadata` — never from localStorage or client-controlled state.
- AI_ENGINEER has the same centralized capabilities as HEAD_TECHNICAL but is **not** ADMIN.
- `invite-employee` Edge Function is server-side, `verify_jwt=true`, deployed as version 6. Redirect: `https://system.kesraa.com/auth/setup-password`.

## Employees (only these 7 need accounts)

| Name | Role | Employee ID | Email (authoritative) |
|---|---|---|---|
| Reda Fathy | CEO / ADMIN | `emp-reda` | `Redaf3941@gmail.com` |
| Toqa Osama | HEAD_TECHNICAL + ADMIN | `emp-toqa` | `headtechnical@kesraa.com` |
| Rahma Ehab | AI_ENGINEER | `emp-rahma-ai` | `ai.specialist@kesraa.com` |
| Shahd Mohamed | TEAM_LEADER (AM) | `emp-shahd` | `shahd.mohamed.kesra@gmail.com` |
| Mohamed Abo AlAtta | TEAM_LEADER (Media Buying) | `emp-aboalatta` | `medialeader@kesraa.com` |
| Esraa Waleed | TEAM_LEADER (SEO) | `emp-esraa` | `esraa.seo.kesra@gmail.com` |
| Noran Ayman | TEAM_LEADER (Social Media) | `emp-nouran` | `Social.kesra3@gmail.com` |

- Do not invent alternative emails.
- `emp-nouran` spelling is the existing ID — do not "fix" it.
- Supabase Auth stores emails lowercased; any email comparison must be case-insensitive.

### Shahd — current state, DO NOT REVERT

- Auth UID `9b226bb7-bd15-4dec-83a0-d0a1dbacb4bc`, email corrected on the SAME Auth user (no duplicate), confirmed, `account_enabled = true`, `public.employees.email` corrected.

## Rules

**Workflow per task:** audit → state the real cause → propose minimal fix → implement only that → validate → report.

**Validation after any code change:**
- `npm run lint`
- `npm run build`
- `git diff --check`

**Report:** findings, changed files, validation output, any SQL/migration created.

**Git:**
- No commit / push unless explicitly asked.
- No reset / checkout / revert / stash of existing changes without asking.

**Scope:**
- Smallest necessary change. No unrelated files. No refactoring for its own sake.
- No schema, RLS, or Auth-architecture changes unless explicitly requested.
- Any DB change: show the SQL/migration first; do not apply without approval.
- Never modify production data unintentionally.

**Security:**
- No service-role key or passwords in frontend code, ever.
- No bypass of Supabase Auth or RLS.
- No duplicate employees or Auth users.
