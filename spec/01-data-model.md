# 01 — Data model

The schema in `supabase/migrations/` is authoritative. This document explains
*why* it looks the way it does, so changes don't quietly break the metrics.

## Entities

| Table             | Represents                                        |
| ----------------- | ------------------------------------------------- |
| `app_user`        | A TA or admin who logs in                         |
| `owner`           | Whoever a print belongs to. Does not log in.      |
| `printer`         | One physical machine                              |
| `spool`           | One physical roll of filament                     |
| `job`             | A request for something to be printed             |
| `attempt`         | One run of a job on one printer with one spool    |
| `maintenance_log` | A service event on a printer                      |

## The job / attempt split

This is the load-bearing decision. Prints fail, and a failed print consumes
filament and machine hours that must be attributed somewhere. If a job carried
its own printer, spool, and duration, a re-run would overwrite that history.

Consequences worth internalising:

- A job has no printer. Ask its latest attempt.
- A job has no actual filament figure. Sum its attempts.
- "Is this printing right now?" means "does this job have an attempt with
  `ended_at is null`?"
- Cancelling mid-print is an attempt with `outcome = 'cancelled'`, not a deletion.

## Owner is not a user

Only staff authenticate. The student or course a print belongs to is a plain
record with a name, an email for pickup contact, and an optional quota. This
means: no student onboarding, no password resets, no auth for 400 people, and a
TA can create an owner in three seconds mid-conversation at the desk.

`owner.kind` distinguishes a person from a course-level bucket, because quotas
sometimes attach to `CS4315` as a whole rather than to individuals.

## Units

Grams, minutes, and cents. All integers, all in the database. There are no
kilograms, no hours, no dollars, and no floats anywhere near a filament number.
Format at render time.

## Estimates vs actuals

`job.est_minutes` and `job.est_grams` come from the slicer, and are nullable
because a job is submitted before anyone has sliced it. An operator supplies
them at approval or, at the latest, when starting the print — see
`spec/02-workflows.md`. They exist so the queue can be scheduled before anything
starts printing, which is also why nothing can start without them.

`attempt.actual_grams` is captured at completion. The gap between the two is the
signal — a job that consistently overruns its estimate means someone is
mis-slicing, and a printer whose actuals run high across many jobs is
over-extruding.

## Derived, never stored

These are views. Do not add stored columns that duplicate them.

- `printer_service_status.hours_since_service` — machine hours since last log entry
- `printer_reliability` — attempts, failures, failure rate, wasted grams (90 days)
- `owner_usage` — grams by outcome, and cost in cents, per owner

`owner_usage` splits successful from failed grams rather than summing them. That
is a policy decision left to the UI: a mechanical failure probably shouldn't
count against a student's quota, but a bad model probably should. The data
supports either rule; pick one in the app layer.

## Cost derivation

Cost per gram is `spool.cost_cents / spool.total_grams`, resolved per attempt
against the spool actually used. This is correct even when spool prices change
between purchases, which they will.

## Invariants enforced in the database

- An attempt is finalised atomically: `ended_at`, `outcome`, and `actual_grams`
  are all null or all present (`attempt_finalised_together`).
- `failure_reason` may only be set when `outcome = 'failed'`.
- At most one live attempt per printer (`attempt_one_live_per_printer`).
- A print cannot start on a printer in `maintenance` or `retired`.
- A print cannot start on a spool with less remaining than the job estimate.
- `spool.remaining_grams` never exceeds `total_grams` and never goes below zero.

Application code must not reimplement these. If a constraint fires, surface the
message; don't pre-empt it with a duplicate check that can drift.
