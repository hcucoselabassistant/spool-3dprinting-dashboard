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

```bash
npm install

npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push          # applies supabase/migrations/*.sql
npm run db:types         # regenerates lib/database.types.ts
```

`lib/database.types.ts` is currently a placeholder covering only `app_user`,
because generating it requires a linked project. Run `npm run db:types` before
starting Phase 2 and do not extend the stub by hand.

Copy `.env.example` to `.env.local` and fill in the values from your Supabase
project settings. `SUPABASE_SERVICE_ROLE_KEY` is not used by any code yet — the
RLS policies cover the app — so leave it unset unless something needs to bypass
RLS, and never expose it with a `NEXT_PUBLIC_` prefix.

Seed yourself as an admin from the Supabase SQL editor, after creating your
account. `app_user.id` must match your `auth.users` id:

```sql
insert into app_user (id, email, full_name, role)
values ('<your-auth-uid>', 'you@hc.edu', 'Your Name', 'admin');
```

Until that row exists you can authenticate but you are not staff, and the app
will bounce you back to `/login`. That is the intended behaviour.

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
