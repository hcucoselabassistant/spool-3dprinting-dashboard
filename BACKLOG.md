# Backlog

What to build/do next and why. Three zones: **Recommended order** (forward-looking
shortlist), **Open & in-progress** (all open items by stable number), and
**Completed & resolved** (what shipped). Numbers are stable — never renumbered or
reused.

The app code for v1 is complete and pushed to `main`. Almost everything open
below is **operational** (apply migrations, configure services, verify against
the live database) or **explicitly-deferred future features** — not app-building.

---

## ▶️ Recommended order

Do the operational blockers first; they're small and gate everything else.

1. **#1, #2 — apply the two pending migrations.** Nothing else is real until
   these land in the live database: #1 closes a security gap, #2 makes the
   health endpoint work. Minutes of work (paste into SQL editor).
2. **#3, #4 — finish the deploy wiring** (Vercel env vars, then point
   UptimeRobot at `/api/health`). #4 depends on #2 being applied.
3. **#5 — add a spool.** One row. It unblocks *all* live testing (#6–#10) — no
   print can start without filament on record.
4. **#6, #9 — the two highest-value verifications**: the failure path (#6, the
   one behavior the whole data model exists for) and TA lockout (#9, proves the
   security model actually holds). Then #7, #8, #10 as time allows.

Everything from **#11 down is deferred** — future features and nice-to-haves,
not on the active path. The build plan says leave the big ones (#11–#15) until
the manual flow has run in the lab for a month.

---

## 📋 Open & in-progress

### 1. Apply migration `…150700_harden_job_and_storage.sql` to the live DB  [🔴 blocking — security]
Two direct-API authorization fixes from the security review. Without it, a TA can
`PATCH` `job.status` on their own job via PostgREST and self-approve, bypassing
operator approval and the quota gate; and any staff can delete any job's file.
- **Where:** `supabase/migrations/20260721150700_harden_job_and_storage.sql`
  (already written and committed). Adds a `job` status-guard trigger and tightens
  the `job-files` storage policies.
- **Action:** paste into Supabase → SQL Editor, run once. No type regen needed
  (trigger + policies only, no schema change).
- **Effort:** XS.

### 2. Apply migration `…150800_health_ping.sql` to the live DB  [🔴 blocking — health endpoint]
`/api/health` currently returns `db:"error"` in production because it ran as
`anon`, which has no table privileges (revoked in `…150300`). This adds
`health_ping()`, an anon-callable no-data function, and the route already calls it.
- **Where:** `supabase/migrations/20260721150800_health_ping.sql` (written,
  committed, pushed); route at `app/api/health/route.ts`.
- **Action:** paste into SQL Editor, run once. Then the live endpoint returns
  `{ok:true,db:"up"}`.
- **Effort:** XS.

### 3. Set/verify environment variables in Vercel  [🟠 deploy]
The app builds but in-app account creation fails without the service key.
- **What:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` (server variable, **no** `NEXT_PUBLIC_` prefix). Do
  **not** add `SUPABASE_DB_URL` (local tooling secret only).
- **Where:** documented in `.env.example` and `MAINTAINING.md §7`. Consumed by
  `lib/env.ts` and `lib/supabase/admin.ts`.
- **Effort:** XS.

### 4. Configure the UptimeRobot monitor  [🟠 deploy] — depends on #2
Point a monitor at `https://spool-3dprinting-dashboard.vercel.app/api/health`.
Keeps the free Supabase project from pausing on database inactivity, and alerts
on downtime. Only meaningful once #2 is applied (endpoint must return 200).
- **Effort:** XS.

### 5. Seed inventory with real spools  [🟠 unblocks testing]
Inventory is empty. `guard_spool_sufficient` rejects any attempt whose spool
can't cover the job estimate, so no print can start until at least one spool
exists. Blocks #6–#10.
- **Where:** `/inventory` (operator/admin), `app/(app)/inventory/`.
- **Effort:** S (data entry).

### 6. Live-verify the failure path  [🟡 verification — highest value] — depends on #5
Start a print, finish it as **failed**, confirm: job returns to `queued`, and the
spool's `remaining_grams` **decreased** by the grams entered. This is the one
behavior the whole job/attempt split exists for. If the spool doesn't decrement,
suspect the `security definer` setting on the finalize trigger
(`…150100_state_machine.sql`) — the known silent-corruption failure mode.
- **Effort:** S.

### 7. Live-verify the full print lifecycle  [🟡 verification] — depends on #5
Walk one job `submitted → queued → printing → post_processing →
ready_for_pickup → collected` through the UI, confirming each transition and the
resulting DB state.
- **Effort:** S.

### 8. Live-verify realtime cross-window  [🟡 verification] — depends on #5
Open the floor (`/`) in two browsers; start a print in one; confirm the other
updates within ~1s without refresh. Exercises `app/(app)/realtime-refresh.tsx`
and the `attempt`/`job` realtime publication.
- **Effort:** S.

### 9. Live-verify TA lockout / RLS enforcement  [🟡 verification — highest value]
Create a test `ta` account; confirm they (a) can't reach `/printers`,
`/inventory`, `/reports`, or the floor; (b) can't edit another user's job; (c)
after #1 is applied, can't self-approve their own job via a direct API call.
Proves the three-role model holds at the database, not just the UI.
- **Effort:** S.

### 10. Live-verify in-app account creation  [🟡 verification] — depends on #3
From `/settings/users`, create an account, confirm the temp password works and
the role sticks. Needs the service key set (#3).
- **Effort:** XS.

### 11. Real email delivery on pickup notify  [🔵 deferred feature]
Today the pickup "Notify" action composes a `mailto:` link
(`app/(app)/needs-attention.tsx`, `pickupMailto`). The spec deliberately built the
trigger point and stopped there. Swap in a real email provider behind that action.
- **Fit:** the action already exists; this replaces the `mailto:` with a provider
  call (a new server action + provider key). Out of scope for v1 per `CLAUDE.md`.
- **Effort:** M.

### 12. G-code / 3MF header parsing to auto-fill estimates  [🔵 deferred feature]
On file upload, parse the slicer header to pre-fill `est_minutes` / `est_grams`
instead of typing them. Build plan ranks this #1 after phase 7 — "removes the most
typing."
- **Fit:** hooks into the upload path in `app/(app)/jobs/job-form.tsx` /
  `actions.ts`; parse client-side or in a server action after upload.
- **Effort:** M.

### 13. Drag-to-reschedule on the floor timeline  [🔵 deferred feature]
The timeline (`app/(app)/timeline.tsx`) is read-mostly in v1; assignment happens
from the queue list. Add drag-to-assign/reschedule. Explicitly deferred in
`spec/03-screens.md`.
- **Effort:** L (also implies introducing a scheduled/"outlined" attempt state
  that doesn't exist yet — see the timeline's own note).

### 14. Public read-only status page  [🔵 deferred feature]
A no-login page showing queue depth / rough wait, no names. Build-plan candidate.
- **Fit:** a new public route outside the `(app)` group; must not leak owner data
  (careful RLS / a dedicated aggregate view, à la the `health_ping` pattern).
- **Effort:** M.

### 15. OctoPrint / Klipper polling to auto-finalize attempts  [🔵 deferred feature]
Poll printer firmware to auto-detect completion and finalize attempts, removing
the manual finish step (the biggest source of human error). Build plan: "removes
the most human error but is a substantial project of its own — do not start until
the manual flow has been in real use for a month."
- **Effort:** XL.

### 16. Give cancellation reason its own column  [🟢 schema nicety]
`cancelJob` (`app/(app)/jobs/core-actions.ts`) appends `[cancelled: …]` to
`job.notes` because there's no dedicated column. Fine for v1; worth a real
`cancel_reason` column if cancellations ever get reported on.
- **Effort:** S (migration + small action/UI change).

### 17. Quota-override audit log  [🟢 schema nicety]
Over-quota approvals are logged to the server console only
(`approveJob`, `console.warn`). If overrides ever need review, add an audit
table and write to it instead.
- **Effort:** S–M.

### 18. `ready_at` column for accurate stale-pickup  [🟢 schema nicety]
The floor's "uncollected > 48h" list uses `job.updated_at` as a proxy for when a
job went `ready_for_pickup` (`lib/queries/floor.ts`). Any later edit resets the
clock. A dedicated `ready_at` timestamp set on the `→ ready_for_pickup`
transition would be exact.
- **Effort:** S.

### 19. Harden `owner_usage` if public signup is ever enabled  [🟢 contingent — security]
`owner_usage` runs with definer rights (`security_invoker = off`) so TAs can see
per-owner cost without spool read. Safe **only while public signup is off** (which
the provisioning trigger already requires). If signup is ever enabled, convert it
to a `SECURITY DEFINER` function with an `is_staff()` guard so non-staff auth
users can't read it.
- **Trigger:** only act on this if someone turns signup back on.
- **Effort:** S.

### 20. Automated testing / CI  [🟢 infra]
No CI; the SQL has only ever been applied by hand, never run against a local
Postgres or in a pipeline. Consider a GitHub Action that runs `npm run build` +
lint on PRs, and optionally spins up Supabase local to apply migrations as a
regression net.
- **Effort:** M.

---

## ✅ Completed & resolved

Shipped in v1 (all on `main`, built phase-by-phase per `spec/04-build-plan.md`):

- **Schema, state machine, RLS, realtime, storage** — `supabase/migrations/…000`
  through `…500`. Job/attempt model, trigger-driven status, derived views.
- **Phase 1 — auth & shell**: Supabase SSR auth, `proxy.ts` session refresh,
  `requireStaff` boundary, dark-mode shell.
- **Phase 2 — printers & inventory**: `/printers`, `/inventory`, fleet service
  status. (15 real printers entered.)
- **Phase 3 — owners & job intake**: `/owners`, job form with inline owner
  create + file upload (browser→Storage, to dodge Vercel's 4.5MB action limit).
- **Phase 4 — the core loop**: start-print, the blocking finish modal, all status
  transitions via `core-actions.ts`.
- **Phase 5 — the floor**: summary strip, 12h timeline, merged needs-attention
  list, unassigned queue, realtime.
- **Phase 6 — history & detail**: `/jobs` filtering, `/jobs/[id]` attempt history,
  maintenance-log prompt.
- **Phase 7 — reporting**: `/reports` monthly cost by owner/course + reliability;
  quota warning at approval.
- **Three-role access model** (admin / operator / ta) — `…150600`, RLS + action
  gates + role-aware nav. Replaced the original "all staff see everything" design.
- **In-app user management** — `/settings/users`, service-role client behind
  `server-only`, self-lockout guards.
- **Security review** — no Critical/High; two findings fixed in `…150700`
  (code merged; DB apply tracked as **#1**).
- **Docs** — `README.md` (full), `MAINTAINING.md` (TA ops handbook), `CLAUDE.md`,
  `spec/`. Director briefings `OVERVIEW.md` / `OVERVIEW-ONEPAGE.md` (uncommitted).
