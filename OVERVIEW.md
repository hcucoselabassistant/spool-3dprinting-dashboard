# Spool — Project Overview

*A briefing on what the 3D print farm dashboard is, how it's used, and what it
runs on.*

---

## What it is, in one paragraph

Spool is an internal web application that the lab's teaching assistants use to
run the 3D print farm. It replaces the whiteboard-and-spreadsheet approach with a
single shared dashboard: TAs take in print requests, assign them to printers,
track how much filament each print uses, record failures, and manage pickup.
It is used only by staff — students never log into it — and it runs entirely on
free, hosted services with no server for us to maintain.

## The problem it solves

A print farm generates questions a spreadsheet can't reliably answer:

- **What did filament actually cost, and who used it?** Needed for budgeting and
  for holding courses or students to a quota.
- **Which printers are unreliable or overdue for service?** Needed to plan
  maintenance before a machine fails mid-print.
- **What's printing right now, what's waiting, and what's ready for pickup?**
  Needed so two TAs on shift aren't stepping on each other.

Spool answers these by recording every print *attempt* — including the ones that
fail — rather than just the final result. That's the core design idea: a failed
print still consumed filament and machine time, and that has to be counted.

## How it's used, day to day

1. A student brings a print request to the desk. A TA enters it as a **job**,
   creating the student's record on the spot if they're new (a few seconds, no
   student account needed).
2. An **operator** approves the job and assigns it to an available printer,
   picking the filament spool the system suggests.
3. When the print finishes, the operator records the outcome — success or
   failure, and how much filament was actually used. This one step feeds every
   number the system produces, so it's designed to be quick and hard to skip.
4. A failed print goes back in the queue to be re-run; the failure is kept on
   record. A successful print moves to a pickup shelf, and the student is
   notified.
5. The **floor dashboard** shows all of this live on a shared screen — what's
   printing, what needs attention, and what's queued.

## Who can do what — three roles

Access is tightly controlled, enforced at the database level (not just hidden in
the interface):

| Role | What they can do |
| --- | --- |
| **Admin** | Everything, including creating staff accounts and setting roles. |
| **Operator** | Run the floor: approve jobs, start and finish prints, manage printers and filament inventory. Everything except managing accounts. |
| **TA** | Take in jobs and add students. They can see the queue but cannot start prints, touch inventory or printers, or see other staff. |

New staff accounts start at the most limited level (TA) and are promoted
deliberately by an admin. Removing someone deactivates their account rather than
deleting it, so historical records stay intact.

## Key features

- **Live floor dashboard** — a shared, always-current view of every printer,
  the next 12 hours, and a single prioritized "needs attention" list.
- **Full print history** — every job shows all of its attempts, so you can see
  exactly why something took three tries and on which machines.
- **Filament tracking** — spools are tracked by weight and cost; the system
  suggests which spool to use and warns when one runs low.
- **Printer maintenance** — tracks hours since last service against each
  machine's interval and flags overdue printers; service events are logged.
- **Cost & reliability reports** — monthly filament cost broken down by student
  and by course, plus a failure-rate table per printer. This is the number you'd
  put in a budget request.
- **Quotas** — optional per-student or per-course filament limits, with a warning
  (not a hard block) at approval time so a TA can always override in a pinch.
- **Student privacy by design** — students are records, not users; there are no
  student logins, passwords, or personal accounts to manage or secure.

## The services it runs on

Spool is built on four hosted services, each doing one job. All four are on
free plans today.

### Supabase — the database and the security
**What it is:** a hosted database (the system of record for every job, printer,
spool, and student) that also handles staff logins and stores uploaded print
files.
**Why we use it:** it gives us a professional-grade database, user authentication,
and file storage as one managed service, so there's no database server for us to
run, patch, or back up. Critically, the access rules — who can see and change
what — are enforced *inside* the database itself, which is far safer than relying
on the app alone.

### Vercel — the hosting
**What it is:** the service that runs the actual website and serves it to
browsers.
**Why we use it:** it deploys the app automatically whenever we update the code,
requires no server administration, and is the standard, well-supported home for
an app built with our framework (Next.js). There's nothing to configure on a
machine somewhere — a change goes live on its own.

### GitHub — the source code
**What it is:** where the project's code lives, with a full history of every
change.
**Why we use it:** it's the permanent, shareable home for the code so the project
isn't trapped on one person's laptop. It also drives deployment — when an update
is saved to GitHub, Vercel picks it up and publishes it. This is what makes the
project survivable when a TA graduates: the next person clones it from GitHub and
keeps going.

### UptimeRobot — keeping it awake
**What it is:** a free monitoring service that checks the site every few minutes.
**Why we use it:** the free Supabase plan pauses a project that sits idle for
about a week. UptimeRobot visits a special address on the site on a schedule,
which quietly keeps the database active so it never pauses on us — and, as a
bonus, alerts us if the site ever goes down.

## What it costs

**Nothing, currently — all four services are on free tiers.** That covers a farm
of this size (roughly 16 printers and a handful of staff) comfortably. Two things
worth knowing for the future:

- Supabase's free plan has storage and usage limits; a farm several times this
  size, or years of accumulated files, could eventually need a paid plan
  (low tens of dollars a month).
- Vercel's free plan is intended for non-commercial use. An internal university
  tool generally fits, but if the institution ever needs a formal commercial
  agreement, that's the one to revisit.

Neither is a concern at present.

## Security and privacy posture

- **No student data exposure.** Students don't have accounts. The only personal
  information stored is a name and an optional contact email for pickup, entered
  by staff.
- **Staff-only, with least-privilege access.** Every screen and every action is
  gated by role, enforced in the database, so a TA physically cannot reach
  admin functions even by trying.
- **The app was security-reviewed.** A dedicated review checked for the common
  mistakes (leaked keys, weak access rules, privilege loopholes) and the findings
  were fixed.
- **Secrets are protected.** The sensitive keys are never sent to the browser and
  never stored in the shared code.

## Keeping it running

Day-to-day, it runs itself — there's no server to babysit. The occasional
maintenance (adding staff, applying a database update, deploying a change) is
documented in the project's `MAINTAINING.md` handbook, written for a TA with no
prior exposure to the codebase. Because the code lives on GitHub and the services
are all managed, the project transfers cleanly from one cohort of TAs to the next.

## The short version

Spool turns an ad-hoc, spreadsheet-driven operation into a shared system of
record that can actually answer the questions the lab needs answered — cost,
usage, reliability, and status — while keeping student data minimal and staff
access tightly controlled. It runs on managed, currently-free services with no
hardware to maintain, and it's documented and version-controlled so it outlives
any one TA.
