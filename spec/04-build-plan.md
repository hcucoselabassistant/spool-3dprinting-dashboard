# 04 — Build plan

Seven phases. Do them in order. Each is one Claude Code session. Do not let a
session run past its done-criteria — the failure mode with a spec this detailed
is an agent that builds all seven phases at once and hands you 4,000 lines you
cannot review.

The prompt under each phase is meant to be pasted verbatim.

---

## Phase 1 — Schema and auth ✅ done

> Read CLAUDE.md and spec/01-data-model.md. Apply the migrations in
> supabase/migrations/ to the linked project, generate TypeScript types into
> lib/database.types.ts, and set up Supabase auth with @supabase/ssr including
> a root proxy.ts that redirects unauthenticated users to /login. Build only a
> login page and an empty authenticated shell layout. Do not build any feature
> screens.

**Done when:** you can log in, `app_user` has your admin row, `npm run build`
passes, and a logged-out request to `/` redirects.

Schema applied by hand via `supabase/bundle.sql` — the project lives on an
account the CLI cannot manage, so `link` and `db push` are unavailable. See the
README for that route.

Still outstanding, and a blocker for Phase 2:

- `lib/database.types.ts` is the `app_user`-only placeholder. Regenerate it
  with the `--db-url` command in the README before writing any query, and do
  not extend the stub by hand.

---

## Phase 2 — Inventory and fleet ✅ done

> Read spec/03-screens.md sections for /printers and /inventory. Build both
> screens with full CRUD for admins, read-only for operators. Use Server
> Components for reads and Server Actions for writes, with all queries in
> lib/queries/. Include the printer_service_status view on the fleet page.

**Done when:** you can add your real 16 printers and your real spools, and the
service-hours column reads zero for all of them.

15 printers entered. Spools are still empty — not a blocker for Phase 3, but
Phase 4 cannot start a print without one, so they have to exist before the core
loop. The maintenance-log prompt on returning a printer to service is
deliberately left to Phase 6, which owns that UI.

Do this before the job flow. Everything downstream needs real printers and
spools to point at, and entering them is the only genuinely tedious step in the
whole project.

---

## Phase 3 — Owners and job intake ✅ done

> Read spec/01-data-model.md and spec/03-screens.md. Build /owners with inline
> creation, and a job submission form. The form captures owner (with
> type-ahead and inline create), title, material, colour preference, slicer
> estimates in minutes and grams, deadline, notes, and an optional file upload
> to a Supabase Storage bucket named job-files. New jobs land in status
> 'submitted'.

**Done when:** you can submit a job end to end and see it in the database with
a real owner attached.

Screens reviewed and the job-files storage migration applied. Still worth one
real end-to-end submission with a file attached before leaning on it in Phase 4
— that is the one path the upload-then-insert ordering and the owner-usage
merge have not yet seen against live data.

---

## Phase 4 — The core loop

> Read spec/02-workflows.md in full. Build the start-print flow and the
> finish-print modal. Start-print takes a queued job, an available printer, and
> a suggested spool, and inserts an attempt. Finish-print requires outcome,
> actual grams, and failure reason when failed. Let the database triggers drive
> job status and printer state — do not write job.status from application code.
> Surface raised Postgres exceptions as user-facing errors.

**Done when:** a job goes submitted → queued → printing → post_processing →
ready_for_pickup → collected, and a deliberate failure returns it to queued with
the spool correctly decremented.

This is the phase that matters. Test the failure path manually before moving on.

---

## Phase 5 — The floor view

> Read spec/03-screens.md section for /. Build the dashboard: summary strip,
> printer timeline for the next 12 hours, merged needs-attention list, and the
> unassigned queue with printer assignment. Subscribe to Supabase Realtime on
> attempt and job so two operators see the same state.

**Done when:** the dashboard reflects a print started in another browser window
within a second, without a refresh.

`attempt` and `job` are already in the `supabase_realtime` publication with
replica identity full — see the realtime migration. Subscribe with the browser
client in `lib/supabase/client.ts`; realtime still respects RLS.

---

## Phase 6 — History and detail

> Build /jobs with filtering by status, owner, and printer, and /jobs/[id] with
> the full attempt history. Add the maintenance log UI to the printer detail
> view, prompted when a printer returns from maintenance state.

**Done when:** you can answer "why did this job take three tries" from the UI
alone.

---

## Phase 7 — Reporting

> Surface the printer_reliability and owner_usage views. Add a quota warning at
> job approval time that warns but does not block, and logs overrides. Add a
> simple monthly filament cost summary grouped by owner and by course_code.

**Done when:** you can produce the number you would put in a budget request.

---

## After phase 7

Candidates, roughly in order of value:

1. G-code header parsing to auto-fill estimates on upload
2. Real email delivery on the pickup-notify action
3. Drag-to-reschedule on the timeline
4. A read-only public status page showing queue depth, no names
5. OctoPrint or Klipper polling to auto-finalise attempts

Number one removes the most typing. Number five removes the most human error but
is a substantial project of its own — do not start it until the manual flow has
been in real use for a month.
