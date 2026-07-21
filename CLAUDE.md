# CLAUDE.md

Context for Claude Code working in this repo. Read `spec/` for detail; this file
is the always-loaded summary.

## What this is

An internal dashboard used by teaching assistants and administrators to run a
university 3D print farm of roughly 16 printers. It is not public-facing and
never will be. Students do not log in — they are records, not users.

## Roles

Three, in `user_role`. Least privilege; new accounts default to `ta`.

- **admin** — everything, including creating accounts and setting roles.
- **operator** — everything except account management: the floor, printers,
  inventory, owners, and full control of every job. "admin minus accounts."
- **ta** — creates jobs and owners; reads every job but edits (cancels) only
  their own; **no** access to the floor, printers, inventory, or reports, and
  cannot see other staff records.

RLS in `20260721150600_three_roles.sql` is the real boundary. Server Actions
re-check the role only so a denied action returns a sentence instead of a silent
zero-row write, and the nav hides links a role can't use. Helpers:
`is_admin()`, `can_operate()` (admin or operator), `is_staff()` (any active).
In TypeScript, express "TA" as `!canOperate(staff)` — never a `"ta"` literal, so
the check stays correct against the generated enum.

## The single most important modelling rule

A **job** is a request. An **attempt** is one run on one printer with one spool.
One job has many attempts, because prints fail. Never collapse these into one
table. Every metric this project exists to produce — filament cost, per-user
quota, printer reliability, machine hours — is an aggregate over `attempt`, not
over `job`. If a change would make it possible to lose the record of a failed
run, reject that change.

## Conventions

- TypeScript strict mode. No `any`. Database types are generated, not hand-written:
  `npm run db:types`
- This is **Next.js 16**. The `middleware.ts` convention is gone — it is `proxy.ts`
  at the repo root, exporting `proxy()`. Version-exact docs are bundled at
  `node_modules/next/dist/docs/`; read them rather than relying on recall.
- Server Components by default. Add `"use client"` only for genuine interactivity
  (drag, form state, live subscriptions).
- Authentication is checked in `lib/auth.ts` (`requireStaff`), next to the data.
  `proxy.ts` only does an optimistic cookie check and a redirect — never put an
  authorization decision there alone, it runs on every prefetch.
- All database access goes through `lib/queries/*.ts`. No inline Supabase calls
  inside components.
- Mutations are Server Actions in `app/**/actions.ts`, not API routes.
- Filament is always stored in **grams (integer)**. Durations are always stored
  in **minutes (integer)**. Money is **cents (integer)**. Never floats for these.
- Timestamps are `timestamptz`, always UTC in the database, formatted to America/Chicago
  at render time only.
- Enum values live in Postgres enums and are mirrored in generated types. Do not
  define parallel string unions by hand.

## Deliberately out of scope for v1

Do not build these unless explicitly asked:

- Student-facing portal or self-service submission
- Email/SMS notification delivery (build the trigger point, log it, stop there)
- Slicer integration or G-code parsing (accept typed estimates for now)
- Multi-site or multi-lab support
- Mobile-optimised layouts beyond basic responsive behaviour

Cost reporting UI was originally out of scope but was pulled in during Phase 7
by explicit decision, as the `/reports` route (monthly filament cost by owner
and course, plus printer reliability). That makes seven routes, not six.

## Things that will look like bugs but are not

- The **attempt-driven** `job.status` transitions are set by triggers, never by
  the UI: `queued → printing`, `printing → post_processing`, and
  `printing → queued` on failure. Writing those from application code
  desynchronises the printer state.

  The four **operator-driven** transitions are the app's job and are written
  normally: `submitted → queued` (approve), `post_processing →
  ready_for_pickup`, `ready_for_pickup → collected`, and `* → cancelled`.
  See the table in `spec/02-workflows.md` for which is which.
- `printer.hours_since_service` is a view column, not a stored column.
- A spool's `remaining_grams` decrements only when an attempt is finalised, and
  it decrements for failed attempts too. That is intentional.
- The trigger functions are `security definer` on purpose. Without it their
  cascading writes are filtered by the target table's RLS and silently affect
  zero rows — an operator would finalise a print and the spool would never
  decrement. Do not "clean this up".

## Definition of done for any phase

- `npm run build` passes with no type errors
- No new `any`, no `@ts-expect-error`
- New tables/columns have RLS policies in the same migration
- Manual smoke path described in the phase still works end to end
