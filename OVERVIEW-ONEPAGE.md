# Spool — One-Page Summary

**What it is.** An internal web app the teaching assistants use to run the 3D
print farm. It replaces the whiteboard-and-spreadsheet with one shared dashboard
for taking in print requests, assigning them to printers, tracking filament and
failures, and managing pickup. Staff-only — students never log in.

**Why it matters.** It answers the questions a spreadsheet can't keep straight:
what filament cost and who used it, which printers are unreliable or overdue for
service, and what's printing / queued / ready right now. It does this by
recording every print *attempt* — including failures, which still cost filament
and machine time.

**How it's used.** A TA enters a student's request as a job (creating the student
record on the spot). An operator approves it, assigns a printer and spool, and —
when the print finishes — records the outcome and filament used. Failures go back
in the queue and stay on record; successes move to a pickup shelf. A live floor
dashboard shows it all on a shared screen.

**Who can do what (enforced in the database, not just hidden):**

| Role | Scope |
| --- | --- |
| **Admin** | Everything, including creating accounts. |
| **Operator** | Run the floor, printers, and inventory — everything but accounts. |
| **TA** | Take in jobs and add students; can't start prints, touch inventory, or see other staff. |

**Key features:** live floor dashboard · full per-job attempt history · filament
tracking with low-spool warnings · printer service tracking · monthly cost
reports by student and course · printer reliability stats · optional quotas ·
no student accounts to secure.

**What it runs on (all on free plans today):**

| Service | What it does | Why |
| --- | --- | --- |
| **Supabase** | Database, staff logins, file storage | One managed service; access rules enforced inside the database. No server to run. |
| **Vercel** | Hosts and serves the website | Auto-deploys on every code update; no server administration. |
| **GitHub** | Stores the code and its history | Permanent, shareable home; lets the project outlive any one TA. |
| **UptimeRobot** | Pings the site on a schedule | Keeps the free database from pausing when idle, and alerts on downtime. |

**Cost:** free at this scale. Future caveats only: Supabase's free tier has usage
limits (a much larger farm could need ~tens of dollars/month), and Vercel's free
tier is non-commercial (revisit only if the institution needs a formal agreement).

**Security & privacy:** no student accounts (only a name + optional pickup email,
entered by staff); least-privilege staff access enforced in the database;
security-reviewed with findings fixed; sensitive keys never reach the browser.

**Continuity:** runs itself — no server to babysit. Maintenance is documented in a
`MAINTAINING.md` handbook written for a TA new to the code, and everything lives
on GitHub, so it transfers cleanly between cohorts.
