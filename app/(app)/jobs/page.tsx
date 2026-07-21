import { StatusPill } from "@/components/status-pill";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatGrams, formatMinutes } from "@/lib/format";
import { getRecentJobs } from "@/lib/queries/jobs";
import { getOwnerOptions } from "@/lib/queries/owners";

import { NewJobForm } from "./job-form";

export const metadata = { title: "Jobs · Spool" };

export default async function JobsPage() {
  await requireStaff();

  const [owners, jobs] = await Promise.all([
    getOwnerOptions(),
    getRecentJobs(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-muted">
            Filtering by status, owner, and printer arrives in Phase 6.
          </p>
        </div>
        <NewJobForm owners={owners} />
      </div>

      {jobs.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-8 text-center text-muted">
          No jobs yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="grid grid-cols-12 items-center gap-3 border-b border-border px-3 py-3 text-sm last:border-b-0"
            >
              <div className="col-span-4">
                <p className="font-medium">{job.title}</p>
                <p className="text-muted">
                  {job.owner?.display_name ?? "unknown owner"}
                </p>
              </div>
              <div className="col-span-2 text-muted">{job.material}</div>
              <div className="col-span-3 text-muted">
                {formatMinutes(job.est_minutes)} · {formatGrams(job.est_grams)}
              </div>
              <div className="col-span-2 text-muted">
                {job.needed_by ? formatDate(job.needed_by) : "—"}
              </div>
              <div className="col-span-1 text-right">
                <StatusPill status={job.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
