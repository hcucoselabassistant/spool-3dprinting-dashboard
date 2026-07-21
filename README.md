# Spool — HCU's internal 3D print farm dashboard

Spool is the internal tool a university 3D-printing lab uses to run its print
farm. Teaching assistants take in print requests, schedule them onto ~16
printers, track filament and failures, and hand finished prints back to
students. It replaces the whiteboard-and-spreadsheet setup that most labs limp
along with, and it exists to answer four questions a spreadsheet can't keep
straight: **what did filament cost, how much has each student used, which
printers fail most, and how many hours is each machine overdue for service.**

It is staff-only and not public-facing. Students never log in — they are
records, not users.

- **New here and need to keep it running?** Read [`MAINTAINING.md`](MAINTAINING.md).
- **Changing how jobs or attempts work?** Read [`spec/01-data-model.md`](spec/01-data-model.md)
  and [`spec/02-workflows.md`](spec/02-workflows.md) first.

---

## How it works

### The core model: jobs vs. attempts

This is the one idea everything else hangs on.

- A **job** is a *request* — "print this thing for this person."
- An **attempt** is *one run* of that job on one printer with one spool.

One job has many attempts, because prints fail and get re-run. A job carries no
printer, no spool, no actual filament figure — you get those from its attempts.
Every metric the lab cares about is a sum over **attempts**, and a failed attempt
is kept forever, never overwritten. Filament is even deducted for failed prints,
because that waste really was spent and has to be attributed to someone.

### Status is driven by the database, not by buttons

A job moves through `submitted → queued → printing → post_processing →
ready_for_pickup → collected` (with `cancelled` reachable from a few states).
The **attempt-driven** parts of that machine are enforced by Postgres triggers,
not application code:

- Insert an attempt → triggers set the job and printer to `printing`.
- Finalise an attempt → triggers decrement the spool, free the printer, and move
  the job forward (to `post_processing` on success, back to `queued` on failure).

The app only writes the **operator-driven** transitions (approve, mark-ready,
collect, cancel). This split is why the data stays consistent even with two TAs
working the floor at once.

### Three roles

Access is enforced by Postgres Row-Level Security — the app UI just hides what a
role can't use.

| Role | Scope |
| --- | --- |
| **admin** | Everything, plus creating accounts and setting roles. |
| **operator** | Everything except account management: the floor, printers, inventory, owners, full control of every job. |
| **ta** | Create jobs and owners; read all jobs but edit only their own; no access to the floor, printers, inventory, or reports. |

### Request flow

A read (say, the jobs list) is a **Server Component** that calls a function in
`lib/queries/`, which runs against Supabase carrying the signed-in user's
session — so RLS decides what rows come back. A write (approve a job, start a
print) is a **Server Action** that re-checks the user's role, then issues the
change; RLS is the backstop if the check is ever wrong. The floor view keeps
itself live over **Supabase Realtime**, so a print started in one browser shows
up in another within a second.

### Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router) + TypeScript (strict) + Tailwind |
| Backend | Supabase — Postgres, Auth, Storage, Realtime |
| Hosting | Vercel |
| Keep-alive | UptimeRobot → `/api/health` |

---

## Repo breakdown

```
app/                     Next.js App Router — every screen and its server actions
  (app)/                 The authenticated area (route group; the "(app)" is not in URLs)
    page.tsx             /          Floor — the shift dashboard (operator+)
    layout.tsx           Nav, role-aware, and the realtime subscriber
    jobs/                /jobs, /jobs/[id] — intake, list, detail, the core loop
      actions.ts         Create a job (+ inline owner, + file upload path)
      core-actions.ts    The status machine: approve, start, finish, ready, collect, cancel
      finish-modal.tsx   The finish-print modal — the highest-value interaction
      start-modal.tsx    Start-print with spool suggestion
    printers/            /printers — fleet, service status, maintenance log (operator+)
    inventory/           /inventory — spools (operator+)
    owners/              /owners — owners, quotas, usage (all staff)
    reports/             /reports — monthly cost + reliability (operator+)
    settings/users/      /settings/users — account management (admin only)
  api/health/route.ts    Keep-alive endpoint that runs a real DB query
  login/                 The one unauthenticated screen

lib/
  queries/               EVERY database read lives here. Screens never query directly.
  supabase/              Three clients: server (RLS), client (browser/realtime), admin (service role)
  auth.ts                requireStaff / requireOperator / requireAdmin — the authorization boundary
  database.types.ts      GENERATED from the schema. Never hand-edit.
  config.ts, format.ts   Thresholds, and grams/minutes/cents/timezone formatting
  env.ts                 Validates the Supabase env vars at startup

components/              Shared UI: status pills (tokenised colours), forms, modal

proxy.ts                 Next.js 16's middleware. Refreshes the session, guards routes.

supabase/
  migrations/            THE SCHEMA AND ALL SECURITY RULES. The most important directory.
  bundle.sql             Generated: all migrations concatenated, for the SQL editor
  teardown.sql           Generated-adjacent: drops everything (test resets only)

spec/                    Why the app is shaped this way (data model, workflows, screens, plan)
CLAUDE.md                Always-loaded conventions and rules for AI-assisted work
MAINTAINING.md           Operations handbook for future TAs
```

The migrations, in order:

| File | What it establishes |
| --- | --- |
| `…150000_initial_schema` | Tables, enums, the derived views |
| `…150100_state_machine` | The status/spool/printer triggers |
| `…150200_rls_policies` | Original row-level security |
| `…150300_realtime_and_grants` | Realtime publication; revoke anon |
| `…150400_staff_provisioning` | Auto-create `app_user` on signup |
| `…150500_job_files_storage` | The `job-files` storage bucket + policies |
| `…150600_three_roles` | admin / operator / ta model (replaces RLS) |
| `…150700_harden_job_and_storage` | Status-change guard; tighten file bucket |

---

## Setup

You need Node 20+ and a Supabase project. `npm install` covers the JS side.

### 1. Apply the database schema

**If your Supabase CLI login can manage the project** (you created it under the
same account, not via the Vercel integration):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push        # applies supabase/migrations/*.sql in order
```

**If the project lives on another account** (the CLI errors with a privileges
message — common when it was created elsewhere or through Vercel), apply it by
hand. For a fresh project, paste the combined bundle into **Supabase dashboard →
SQL Editor** and run it once:

```bash
npm run db:bundle      # regenerates supabase/bundle.sql from the migrations
```

For an existing project, apply just the new migration files, in order, the same
way. Requires **Postgres 15+** (the views use `security_invoker`).

### 2. Generate the TypeScript types

```bash
set -a; . ./.env.local; set +a
npm run db:types
```

Two non-obvious requirements, each of which looks like an unrelated failure:

- **Docker must be running** (`open -a Docker`) — the CLI introspects the schema
  in a container, even against a remote database. This is the only thing in the
  project that uses Docker.
- **Use the session-pooler connection string**, not the direct one.
  `db.<ref>.supabase.co` is IPv6-only and fails on most networks. Take the
  **Session pooler** string from Supabase → Settings → Database (host
  `aws-N-<region>.pooler.supabase.com`, port 5432, user `postgres.<ref>`) and
  keep it in `.env.local` as `SUPABASE_DB_URL`.

Never hand-edit `lib/database.types.ts` — regenerate it. A drifted type fails at
runtime instead of at compile time.

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill it in. Every variable is documented
there. The full table, including which are secret, is in
[`MAINTAINING.md`](MAINTAINING.md#7-environment-variables). The one that matters
most: `SUPABASE_SERVICE_ROLE_KEY` bypasses all database security — it is
server-only, never gets a `NEXT_PUBLIC_` prefix, and is required for in-app
account creation.

### 4. Turn off public signup, then create yourself as admin

In Supabase → Authentication → Sign In / Providers → Email, turn **off** "Allow
new users to sign up." The provisioning trigger makes every new auth user a
staff member, so this must stay off — the only way to create an account is an
admin doing it deliberately.

Create your account (Authentication → Users → Add user, tick **Auto Confirm
User**), then promote it once from the SQL Editor:

```sql
update app_user set role = 'admin' where email = 'you@hc.edu';
```

After that, add everyone else in-app at **/settings/users**.

### 5. Run it

```bash
npm run dev            # http://localhost:3000
```

---

## Deploying

Vercel builds and deploys the `main` branch automatically. Set the same
environment variables in the Vercel project settings — `SUPABASE_SERVICE_ROLE_KEY`
as a **server** variable (no `NEXT_PUBLIC_`), and do **not** add `SUPABASE_DB_URL`
(it's a local tooling secret).

Supabase pauses a free project after ~a week of **database** inactivity, so point
an UptimeRobot monitor at `https://<your-app>/api/health`. That endpoint runs a
real query — a static page or plain 200 check would let the database pause while
the ping kept succeeding.

Always run `npm run build` locally before pushing: it catches type errors that
`npm run dev` doesn't, and those are the usual cause of a green-locally,
red-on-Vercel deploy.

---

## Working on the code

- **TypeScript strict, no `any`, no `@ts-expect-error`.**
- **Server Components by default**; `"use client"` only for real interactivity.
- **All database reads go through `lib/queries/`**; all writes are Server Actions.
- **Grams, minutes, and cents are integers** — never a float near a filament
  figure. Format at render time only.
- **New tables get RLS policies in the same migration.**
- **Never edit an applied migration** — add a new one with a later timestamp.

The full rationale for these lives in `CLAUDE.md` (loaded automatically by AI
assistants) and the `spec/` documents.

## Documents

- [`MAINTAINING.md`](MAINTAINING.md) — operations handbook: accounts, deploys,
  the database, troubleshooting
- `CLAUDE.md` — always-loaded conventions and house rules
- `spec/01-data-model.md` — entities, invariants, derived values
- `spec/02-workflows.md` — the status machine and business rules
- `spec/03-screens.md` — the screens and role access
- `spec/04-build-plan.md` — how it was built, phase by phase
- `supabase/migrations/` — the authoritative schema, security, and triggers
