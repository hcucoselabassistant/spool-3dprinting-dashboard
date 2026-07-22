# 02 — Workflows

## Job status machine

```
submitted ──approve──► queued ──start attempt──► printing
                         ▲                          │
                         │                          ├─ success ──► post_processing
                         └──────── failed ──────────┤                    │
                                                    └─ cancelled ─┘      ▼
                                                                 ready_for_pickup
                                                                         │
                                                                     collect
                                                                         ▼
                                                                    collected
```

`cancelled` (the job status, distinct from the attempt outcome) is reachable
from `submitted`, `queued`, or `post_processing` by explicit operator action.

### Who moves what

| Transition                          | Driver                                    |
| ----------------------------------- | ----------------------------------------- |
| `submitted → queued`                | Operator approves                         |
| `queued → printing`                 | Trigger, on attempt insert                |
| `printing → post_processing`        | Trigger, on attempt finalise with success |
| `printing → queued`                 | Trigger, on failure or cancellation       |
| `post_processing → ready_for_pickup`| Operator marks finished                   |
| `ready_for_pickup → collected`      | Operator records handover                 |
| `* → cancelled`                     | Operator, with a reason                   |

Application code never writes `job.status` for the trigger-driven rows. Doing so
will desynchronise the printer state.

## Who supplies the estimate

`est_minutes` and `est_grams` are the slicer's numbers, so they belong to
whoever has the slicer open — the operator, not the person taking the request at
the desk. Intake never asks for them.

- **At approval** the operator may enter them. Optional: approving a stack of
  desk requests before slicing any of them is the normal case. A queued job with
  no estimate is flagged `needs estimate` in the queue.
- **At start** they are required, pre-filled from approval if they were given
  there and still editable — the operator is looking at the slice right now, and
  re-slicing a job that failed is ordinary, not an exception.

Numbers typed at start win over anything recorded earlier. Nothing reaches a
printer unestimated: `startPrint` refuses, and `guard_spool_sufficient` raises
on a null estimate rather than letting a NULL comparison wave the attempt
through.

The over-quota warning fires **once, wherever `est_grams` is first written** —
at approval if the numbers were known then, otherwise in the start dialog. It
warns and never blocks, in both places.

## Starting a print

1. Operator picks a queued job and an available printer.
2. Estimate: pre-filled if it was given at approval, required either way. The
   spool list re-narrows as grams are typed.
3. UI suggests spools matching `job.material`, sorted by least remaining that
   still covers `est_grams` — this burns down partial spools first.
4. On confirm, the estimate is written to the job, then an `attempt` is inserted
   with `expected_end = now() + est_minutes`. That order matters:
   `guard_spool_sufficient` reads the estimate off the job row, not off the
   insert.
5. Triggers set the job to `printing` and the printer to `printing`.

If the printer is down or the spool is short, the insert raises. Show the raised
message directly; it is already human-readable.

## Finishing a print

This is the highest-value interaction in the product and the easiest one to
under-build. It must be a blocking modal with three required fields:

- Outcome — success / failed / cancelled
- Actual grams — pre-filled with `job.est_grams`, editable
- Failure reason — shown and required only when outcome is `failed`

Do not make actual grams optional. Do not default the outcome to success in a
way that lets someone dismiss the modal without choosing. Every downstream
number this project exists to produce depends on this modal being answered
honestly, and it has about four seconds of the operator's patience.

Notes are optional and free text.

## Re-running a failure

A failed attempt returns the job to `queued`. It keeps its original estimates and
its place in the queue is recalculated normally. The job detail view shows the
full attempt history, so the next operator can see it already failed twice on
`mk4-04` and pick a different machine.

## Quota checks

At approval time, compare `owner_usage.grams_success` against
`owner.quota_grams`. If approving this job would exceed the quota, warn but do
not block — an operator can always override, because the alternative is a
student's coursework blocked at 11pm with nobody to appeal to. Log the override.

## Maintenance

When `printer_service_status.hours_since_service` exceeds
`printer.service_interval_hours`, flag the printer in the UI. Flagging does not
stop prints. Setting `printer.state = 'maintenance'` does, and that is a
deliberate operator action that also prompts for a `maintenance_log` entry when
the printer comes back.

## Pickup

`ready_for_pickup` jobs carry a `shelf_location`. The dashboard surfaces anything
sitting uncollected for more than 48 hours. For v1 the notify action composes a
`mailto:` link against `owner.email` — real email delivery is out of scope, but
build the action so a provider can be dropped in behind it later.
