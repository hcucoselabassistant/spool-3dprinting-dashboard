# Spool - HCU's Internal 3D Dashboard

Internal dashboard for TAs managing a 3D print farm (~16 printers). Tracks job
intake, printer scheduling, filament consumption, failures, and pickup.

## Stack

| Layer    | Choice                                       |
| -------- | -------------------------------------------- |
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind |
| Backend  | Supabase (Postgres, Auth, Storage, Realtime) |
| Hosting  | Vercel                                       |

## Status

Phase 1 of seven is done: auth, session handling, and an empty authenticated
shell. No feature screens yet. See `spec/04-build-plan.md`.

## Setup

The app is already scaffolded; `npm install` covers the JS side. What remains is
pointing it at a Supabase project.

### If the CLI can manage your project

```bash
npm install

npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push          # applies supabase/migrations/*.sql
npm run db:types         # regenerates lib/database.types.ts
```

### If the project lives on another account

`supabase link` fails with a privileges error when the project belongs to an
account or organisation your CLI session cannot manage — including projects
provisioned through the Vercel integration. Apply the schema by hand instead:

```bash
npm run db:bundle        # writes supabase/bundle.sql
```

Paste that file into the Supabase SQL editor and run it once. It is wrapped in a
transaction and is deliberately **not** idempotent — a second run fails on the
`create type` statements rather than half-applying.

`supabase/bundle.sql` is generated and gitignored. Never edit it; edit the
migrations and regenerate.

Requires **Postgres 15 or newer** — the views use `security_invoker`, which
does not exist before 15.

### Database types

Regenerate `lib/database.types.ts` whenever the schema changes. Never edit it by
hand — a type that drifts from the schema fails at runtime rather than at
compile time.

```bash
set -a; . ./.env.local; set +a
npx supabase gen types typescript --db-url "$SUPABASE_DB_URL" > lib/database.types.ts
```

Two things this needs, both of which look like unrelated failures:

- **Docker running.** The CLI runs `postgres-meta` in a container to introspect
  the schema, even against a remote database. `open -a Docker` first. Nothing
  about the app itself needs Docker; this is the only use for it.
- **The session pooler URL, not the direct one.** `db.<ref>.supabase.co` is
  IPv6-only, and connections fail outright on a network without IPv6. Take the
  **Session pooler** string from Settings → Database (host
  `aws-N-<region>.pooler.supabase.com`, port 5432, username
  `postgres.<project-ref>`) and keep it in `.env.local` as `SUPABASE_DB_URL`.

Copy `.env.example` to `.env.local` and fill in the values from your Supabase
project settings. `SUPABASE_SERVICE_ROLE_KEY` is not used by any code yet — the
RLS policies cover the app — so leave it unset unless something needs to bypass
RLS, and never expose it with a `NEXT_PUBLIC_` prefix.

## Staff accounts

Turn **off** public signup first, at Authentication → Sign In / Providers →
Email → "Allow new users to sign up". The provisioning trigger makes every new
`auth.users` row an operator, which is only safe while the sole way to create
one is an admin doing it deliberately.

To add someone: Authentication → Users → Add user, enter an email and a
password, tick **Auto Confirm User**, and hand them the password. Their
`app_user` row is created automatically as a **`ta`** — the least-privileged
role — no uuid copying.

There are three roles (see CLAUDE.md):

- `ta` — creates jobs and owners; no access to printers, inventory, reports, or
  other staff.
- `operator` — runs the floor and manages printers, inventory, and owners.
- `admin` — everything, including managing accounts.

Promote from the SQL editor as needed:

```sql
update app_user set role = 'admin'    where email = 'you@hc.edu';
update app_user set role = 'operator' where email = 'floor-lead@hc.edu';
-- someone left the operator/admin tier but is still a TA:
update app_user set role = 'ta'       where email = 'former-lead@hc.edu';
```

To revoke access, deactivate rather than delete — `app_user` is referenced by
`job` and `attempt`, and deletion is blocked on purpose so history survives:

```sql
update app_user set active = false where email = 'former-ta@hc.edu';
```

Authenticating and being staff are separate. Someone with an `auth.users` row
but no active `app_user` row is bounced to `/login?error=not-staff`. That is
intended, and it is why signup alone confers nothing.

## Deploying

Vercel, with the same environment variables set in the project settings.

Supabase pauses free-tier projects after a week of **database** inactivity, so
if you keep it alive with UptimeRobot, point the monitor at a route that
actually queries Postgres. A static page or a health check that only returns 200
will not touch the database and the project will still pause.

## Building this with Claude Code

Do not ask Claude Code to build the whole thing in one prompt. Work through
`spec/04-build-plan.md` one phase at a time — each phase is scoped to be
reviewable in a single sitting and has explicit done-criteria.

`CLAUDE.md` is loaded automatically on every turn. The files in `spec/` are not
— reference them explicitly when a phase needs them.

## Documents

- `CLAUDE.md` — persistent context and conventions for Claude Code
- `spec/01-data-model.md` — entities, invariants, derived values
- `spec/02-workflows.md` — state machine and business rules
- `spec/03-screens.md` — UI surfaces and behaviour
- `spec/04-build-plan.md` — phased implementation plan
- `supabase/migrations/` — schema, state machine, RLS, realtime
