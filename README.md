# Spool - HCU's Internal 3D Dashboard

Internal dashboard for TAs managing a 3D print farm (~16 printers). Tracks job
intake, printer scheduling, filament consumption, failures, and pickup.

## Stack

| Layer    | Choice                                      |
| -------- | ------------------------------------------- |
| Frontend | Next.js (App Router) + TypeScript + Tailwind |
| Backend  | Supabase (Postgres, Auth, Storage, Realtime) |
| Hosting  | Vercel (or self-hosted Node)                 |

## First-time setup

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint
npm install @supabase/supabase-js @supabase/ssr
npm install -D supabase

npx supabase init
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations/*.sql
```

Copy `.env.example` to `.env.local` and fill in values from your Supabase
project settings.

Seed yourself as an admin once auth is wired up:

```sql
insert into app_user (id, email, full_name, role)
values ('<your-auth-uid>', 'you@hc.edu', 'Your Name', 'admin');
```

## Building this with Claude Code

Do not ask Claude Code to build the whole thing in one prompt. Work through
`spec/04-build-plan.md` one phase at a time — each phase is scoped to be
reviewable in a single sitting and has explicit done-criteria.

Start with:

```
Read CLAUDE.md and spec/. Then implement Phase 1 only. Stop when the
done-criteria for Phase 1 are met and show me what you changed.
```

`CLAUDE.md` is loaded automatically by Claude Code on every turn. The files in
`spec/` are not — reference them explicitly when a phase needs them.

## Documents

- `CLAUDE.md` — persistent context and conventions for Claude Code
- `spec/01-data-model.md` — entities, invariants, derived values
- `spec/02-workflows.md` — state machine and business rules
- `spec/03-screens.md` — UI surfaces and behaviour
- `spec/04-build-plan.md` — phased implementation plan
- `supabase/migrations/` — schema and RLS, ready to apply
