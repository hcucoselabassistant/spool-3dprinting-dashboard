# Maintaining Spool

This is the handbook for whoever keeps Spool running after the person who built
it has moved on. It assumes you are a TA or admin who can find your way around a
terminal but has not seen this codebase before. Read it top to bottom once; come
back to the sections you need.

If you only remember one thing: **the database is the source of truth, and
Row-Level Security is what protects it.** The app is a friendly front end over
rules that live in Postgres. When something behaves unexpectedly, the answer is
usually in a migration under `supabase/migrations/`, not in the React code.

---

## 1. What you are running

- A **Next.js** web app, deployed on **Vercel**.
- A **Supabase** project (hosted Postgres + Auth + Storage + Realtime).
- **UptimeRobot** pinging `/api/health` so the free Supabase project does not
  pause from inactivity.

Nobody self-hosts anything. If the site is down, it is almost always one of:
Vercel (deploy failed), Supabase (project paused or out of quota), or an expired
credential. Section 8 is the troubleshooting map.

---

## 2. Accounts and access

There are three roles. A person's role is a row in the `app_user` table.

| Role | Can do |
| --- | --- |
| **admin** | Everything, including creating accounts and changing roles. |
| **operator** | Everything except managing accounts: run the floor, manage printers and inventory, control any job. |
| **ta** | Create jobs and owners; see all jobs but edit only their own; no access to printers, inventory, or reports. |

**To add a staff member**, sign in as an admin and go to **Users** in the top
nav (`/settings/users`). Create the account with a temporary password and hand
it over. New accounts default to **TA** — promote from that screen if they need
more.

**If you are locked out with no admin**, you can still fix it from the Supabase
dashboard → SQL Editor:

```sql
update app_user set role = 'admin' where email = 'you@hc.edu';
```

Students never get accounts. They are `owner` records, created in seconds from
the job form. This is deliberate — see the README.

---

## 3. The one idea the whole thing is built on

A **job** is a *request* to print something. An **attempt** is *one run* on one
printer with one spool. One job has many attempts, because prints fail and get
re-run.

Every number this app produces — what filament cost, how much a student used,
which printer fails most — is added up over **attempts**, not jobs. A failed
attempt is kept forever; it is never overwritten. If you are ever tempted to
"clean up" old attempts or merge jobs and attempts into one thing, don't — you
would be deleting the data the whole system exists to produce.

Job status (`submitted → queued → printing → …`) is mostly driven **by database
triggers**, not by buttons. Starting a print inserts an attempt, and a trigger
flips the job to `printing`. Finishing an attempt decrements the spool and
advances the job. The app almost never writes `job.status` directly. If you see
status behaving "magically," that is the triggers in `20260721150100_state_machine.sql`
doing their job.

---

## 4. Making changes safely

### Change the look or wording of a screen
That is React/TypeScript under `app/`. Edit, then from the project folder:

```bash
npm run dev        # local preview at http://localhost:3000
```

When it looks right, commit and push (section 6). Vercel deploys automatically.

### Change the database (add a column, change a rule)
**Never edit an old migration that has already been applied.** Add a *new* file
under `supabase/migrations/` with a later timestamp in the name. Migrations are
applied in filename order and are a permanent history — rewriting old ones makes
your database and the code disagree.

The safe loop:

1. Write a new `supabase/migrations/<timestamp>_what_it_does.sql`.
2. Apply it (section 5).
3. If it changed tables/columns/enums, regenerate the TypeScript types
   (section 5) so the code knows about the change.
4. `npm run build` must pass with no errors before you push.

### The rules of the house (do not break these)
These are enforced in code review and in `CLAUDE.md`. They exist for reasons
that are not obvious until you hit them:

- **No `any` in TypeScript**, no `@ts-expect-error`.
- **Filament is integer grams, durations integer minutes, money integer cents.**
  Never a floating-point number near a filament figure.
- **Every new table gets RLS policies in the same migration.** A table without
  policies is either wide open or fully blocked — both are bugs.
- **Database types are generated, never hand-written.** If you edit
  `lib/database.types.ts` by hand, it will drift from reality and fail at runtime
  instead of at compile time.

---

## 5. The database, hands-on

The Supabase project is on a **separate account** from the CLI login used to
build this, so the normal `supabase link` / `db push` flow does **not** work
here. Everything is done one of two ways.

### Applying a migration (the normal way, by hand)
Open the new migration file, copy its contents, paste into **Supabase dashboard
→ SQL Editor**, and run it. That's it. Apply migrations in order and only once
each — most are not safe to run twice (they create things that would then
already exist).

If you are setting up a **brand-new** Supabase project from scratch, use the
combined file instead — it is every migration in order, in one transaction:

```bash
npm run db:bundle       # regenerates supabase/bundle.sql from the migrations
```

Paste `supabase/bundle.sql` into the SQL Editor and run it once.

### Regenerating TypeScript types (after a schema change)
This needs **Docker running** (`open -a Docker`, wait for it) and the
`SUPABASE_DB_URL` value in `.env.local`. Then:

```bash
npm run db:types
```

Use the **session pooler** connection string (Supabase dashboard → Settings →
Database), not the direct one — the direct host is IPv6-only and fails on most
networks. See the README for the exact format.

### Nuking and rebuilding (rarely, and never with real data)
`supabase/teardown.sql` drops everything the migrations create. It exists for
resetting a test project. **Do not run it against the real database** — it
deletes all jobs, attempts, and print history, which is the one thing this
system is meant to preserve.

---

## 6. Deploying a change

Vercel watches the `main` branch. Push to `main` and it builds and deploys
automatically.

```bash
git add -A
git commit -m "short description of what changed and why"
git push
```

Watch the deploy in the Vercel dashboard. If the build fails there but passed
locally, it is almost always a missing environment variable (section 7) or a
type error that only `npm run build` (not `npm run dev`) catches — always run
`npm run build` before pushing.

To roll back a bad deploy: in the Vercel dashboard, find the last good
deployment and "Promote to Production." Then fix forward in the code.

---

## 7. Environment variables

Set in **three** places and they must match: your local `.env.local`, the Vercel
project settings, and (for the values that come from Supabase) the Supabase
dashboard. `.env.example` lists every variable with a comment.

| Variable | What it is | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (bare origin, no path) | No — public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key | No — public |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key for creating accounts | **YES — server only** |
| `SUPABASE_DB_URL` | Session-pooler connection string, for type generation only | **YES — never deploy** |
| `NEXT_PUBLIC_TIMEZONE` | `America/Chicago` | No |
| `NEXT_PUBLIC_LOW_SPOOL_GRAMS` | Low-spool warning threshold | No |
| `NEXT_PUBLIC_PICKUP_STALE_HOURS` | Uncollected-pickup threshold | No |

**Critical rule:** `SUPABASE_SERVICE_ROLE_KEY` bypasses all database security. It
must never get a `NEXT_PUBLIC_` prefix and must never appear in browser code. In
Vercel it is a normal (server) environment variable. If it ever leaks, rotate it
immediately in the Supabase dashboard.

`SUPABASE_DB_URL` contains the database password. It is only used by the
type-generation command on your laptop; do not put it in Vercel.

---

## 8. When something breaks

**The whole site is down / "database is paused."**
Supabase pauses a free project after ~a week of database inactivity. Un-pause it
in the Supabase dashboard. Then check that UptimeRobot is still hitting
`https://<your-app>/api/health` — that endpoint runs a real query to keep the
database awake, so if it stopped, the project will keep pausing.

**Login fails for everyone / "credentials were not accepted."**
First suspect the environment variables. A common one: `NEXT_PUBLIC_SUPABASE_URL`
set to the REST URL (ending in `/rest/v1/`) instead of the bare project URL. The
app now refuses to start with a clear message if that happens, but check it. The
real reason for any auth failure is logged in the Vercel function logs.

**Someone can't see a page they should ("bounced to /jobs").**
Check their role in the Users screen. TAs are intentionally kept out of the
floor, printers, inventory, and reports.

**A spool's remaining grams looks wrong, or didn't go down after a print.**
Filament is decremented by a trigger when an attempt is *finalised*, and it
decrements for failed prints too. If it is not decrementing at all, the trigger
functions may have lost their `security definer` setting — check
`20260721150100_state_machine.sql` and the note in `CLAUDE.md`. This is the one
bug that silently corrupts your numbers, so take it seriously.

**Creating a user fails.**
`SUPABASE_SERVICE_ROLE_KEY` is missing or wrong in Vercel. Everything else about
the Users screen works without it; only account *creation* needs it.

**A migration errored halfway.**
Most migrations are wrapped so they roll back cleanly on error. Read the error,
fix the SQL, and re-run. If a migration is not safe to re-run (it creates types
or policies that now exist), you may need to comment out the parts that already
succeeded. When in doubt on a test project, teardown and re-bundle.

---

## 9. Where things live

A fuller map is in the README's repo breakdown. The short version:

- `app/` — the screens and their server actions.
- `lib/queries/` — **every database read.** No screen queries the database
  directly; it all funnels through here.
- `lib/supabase/` — the three database clients (server, browser, admin).
- `supabase/migrations/` — **the real schema and all security rules.** This is
  the most important directory in the repo.
- `spec/` — why the app is shaped the way it is. Read `spec/01-data-model.md`
  and `spec/02-workflows.md` before changing anything about jobs or attempts.
- `CLAUDE.md` — the always-loaded rules, including the ones above.

---

## 10. Getting help from an AI assistant

This project was built with an AI coding assistant and is set up to keep working
with one. If you open it in an assistant, `CLAUDE.md` is loaded automatically and
tells the assistant the rules of the house. Point it at `spec/` for detail and at
this file for operations. Ask it to run `npm run build` before you trust a change,
and to write a new migration rather than editing an old one — the same rules you
follow.
