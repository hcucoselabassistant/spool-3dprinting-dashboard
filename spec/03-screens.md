# 03 — Screens

Six routes, plus `/reports` added in Phase 7 by explicit decision. Resist an
eighth.

```
/                     Floor (the dashboard)
/jobs                 All jobs, filterable
/jobs/[id]            Job detail with attempt history
/printers             Printer fleet and service status
/inventory            Spools
/owners               Owners, quotas, usage
/reports              Monthly filament cost and printer reliability
```

Admin-only: `/inventory` and `/owners` for writes, plus a `/settings/users`
page for seeding staff accounts.

## `/` — Floor

The screen a TA leaves open all shift. Three zones, top to bottom.

**Summary strip.** Printing now · in queue · awaiting pickup · printers down.
Each is a link to the filtered view.

**Timeline.** Rows are printers, the x-axis is the next 12 hours. Bars are
attempts: solid for live, outlined for scheduled. A printer in `maintenance`
shows a full-width muted bar. Live bars have a progress fill based on
`now()` against `started_at`/`expected_end`.

The timeline is read-mostly in v1. Clicking a live bar opens the finish-print
modal. Clicking an outlined bar opens the job. Drag-to-reschedule is explicitly
deferred — assignment happens from the queue list below.

**Needs attention.** A merged, heterogeneous list, ordered by urgency:

- Attempts past `expected_end` with no `ended_at` (probably finished, nobody logged it)
- Jobs that failed and are awaiting a re-run decision
- `ready_for_pickup` older than 48 hours
- Spools under 150 g
- Printers past their service interval

Each row has exactly one primary action. Do not build separate panels for these
categories — the point is that a TA reads one list and works down it.

**Unassigned queue.** Jobs in `queued`, sorted by `priority desc, needed_by,
created_at`. Each row shows owner, material, estimates, deadline, and a printer
picker. Selecting a printer opens the start-print confirm with the spool
suggestion pre-filled.

## `/jobs/[id]` — Job detail

Header: title, owner, status pill, deadline. Body: estimates, notes, file
download link. Then the attempt history as a vertical list — printer, spool,
duration, outcome, actual grams, failure reason, operator. This history is the
reason the schema looks the way it does; make it prominent, not a collapsed
accordion.

## `/printers` — Fleet

A card per printer: name, model, state, hours since service against interval,
90-day failure rate, current job if any. Sort by service urgency. Admin can add,
retire, and edit; operators can flag down or return to service, which prompts
for a maintenance log entry.

## `/inventory` — Spools

Grouped by material then colour. Each spool shows remaining as a bar against
total, plus cost per gram. Highlight anything under 150 g. Retired spools are
hidden behind a toggle, never deleted — historical attempts reference them.

## `/owners` — Owners

Table: name, kind, course code, grams used vs quota, cost to date, active job
count. Row expands to that owner's job history. Creating an owner is a single
inline row, not a modal — it happens mid-conversation at the desk and must take
seconds.

## UI principles

- Live data uses Supabase Realtime on `attempt` and `job`. Two TAs on the floor
  will have this open simultaneously; a stale timeline causes double-starts.
- Every destructive or state-changing action is optimistic with rollback, not a
  spinner-blocked round trip.
- Status colour is consistent everywhere: printing, queued, failed, ready,
  maintenance. Define once as tokens; never inline a hex.
- Dark mode from the start. The lab is dim and these screens sit on a wall
  monitor.
- The floor view must be legible from about two metres away — that wall monitor
  is the real deployment target, not a laptop.
