# CLAUDE.md

Context for Claude Code working in this repo. Read `spec/` for detail; this file
is the always-loaded summary.

## What this is

An internal dashboard used by ~6 teaching assistants and 2 administrators to run
a university 3D print farm of roughly 16 printers. It is not public-facing and
never will be. Students do not log in — they are records, not users.

## The single most important modelling rule

A **job** is a request. An **attempt** is one run on one printer with one spool.
One job has many attempts, because prints fail. Never collapse these into one
table. Every metric this project exists to produce — filament cost, per-user
quota, printer reliability, machine hours — is an aggregate over `attempt`, not
over `job`. If a change would make it possible to lose the record of a failed
run, reject that change.

## Conventions

- TypeScript strict mode. No `any`. Database types are generated, not hand-written:
  `npx supabase gen types typescript --linked > lib/database.types.ts`
- Server Components by default. Add `"use client"` only for genuine interactivity
  (drag, form state, live subscriptions).
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
- Cost reporting UI (the SQL views exist; no screen yet)
- Multi-site or multi-lab support
- Mobile-optimised layouts beyond basic responsive behaviour

## Things that will look like bugs but are not

- `job.status` is derived from attempts by triggers, not set directly by the UI.
  If you find yourself writing `update job set status = ...` from application
  code, you are probably working around the state machine — reread
  `spec/02-workflows.md`.
- `printer.hours_since_service` is a view column, not a stored column.
- A spool's `remaining_grams` decrements only when an attempt is finalised, and
  it decrements for failed attempts too. That is intentional.

## Definition of done for any phase

- `npm run build` passes with no type errors
- No new `any`, no `@ts-expect-error`
- New tables/columns have RLS policies in the same migration
- Manual smoke path described in the phase still works end to end
