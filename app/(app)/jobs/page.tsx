import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import { canOperate, requireStaff } from "@/lib/auth";
import { formatDate, formatGrams, formatMinutes } from "@/lib/format";
import {
  getAvailablePrinters,
  getLiveAttemptsByJob,
  getViableSpools,
  type ViableSpool,
} from "@/lib/queries/core";
import { getJobs, getPrinterOptions, type JobFilters as Filters } from "@/lib/queries/jobs";
import { getOwnerOptions } from "@/lib/queries/owners";
import type { Database } from "@/lib/database.types";

import { JobActions } from "./job-actions";
import { JobFilters } from "./job-filters";
import { NewJobForm } from "./job-form";
import type { PrinterOption } from "./start-modal";

export const metadata = { title: "Jobs · Spool" };

type JobStatus = Database["public"]["Enums"]["job_status"];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; owner?: string; printer?: string }>;
}) {
  const staff = await requireStaff();
  const operator = canOperate(staff);
  const sp = await searchParams;

  const filters: Filters = {
    status: isStatus(sp.status) ? sp.status : undefined,
    ownerId: sp.owner || undefined,
    printerId: sp.printer || undefined,
  };

  // The start/finish modals need printers and spools, which only operators can
  // read. A TA never sees those controls, so skip the reads entirely.
  const [owners, printerOptions, jobs] = await Promise.all([
    getOwnerOptions(),
    getPrinterOptions(),
    getJobs(filters),
  ]);

  let printers: PrinterOption[] = [];
  let spools: ViableSpool[] = [];
  let liveAttempts = new Map<string, string>();
  if (operator) {
    [printers, spools, liveAttempts] = await Promise.all([
      getAvailablePrinters(),
      getViableSpools(),
      getLiveAttemptsByJob(),
    ]);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <NewJobForm owners={owners} />
      </div>

      <div className="mb-4">
        <JobFilters owners={owners} printers={printerOptions} />
      </div>

      {jobs.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-8 text-center text-muted">
          No jobs match.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="grid grid-cols-12 items-center gap-3 border-b border-border px-3 py-3 text-sm last:border-b-0"
            >
              <div className="col-span-3">
                <Link
                  href={`/jobs/${job.id}`}
                  className="font-medium hover:text-status-printing hover:underline"
                >
                  {job.title}
                </Link>
                <p className="text-muted">
                  {job.owner?.display_name ?? "unknown owner"}
                </p>
              </div>
              <div className="col-span-2 text-muted">
                {job.material} · {formatGrams(job.est_grams)}
              </div>
              <div className="col-span-2 text-muted">
                {formatMinutes(job.est_minutes)}
              </div>
              <div className="col-span-1 text-muted">
                {job.needed_by ? formatDate(job.needed_by) : "—"}
              </div>
              <div className="col-span-1">
                <StatusPill status={job.status} />
              </div>
              <div className="col-span-3">
                <JobActions
                  job={job}
                  printers={printers}
                  spools={spools}
                  liveAttemptId={liveAttempts.get(job.id) ?? null}
                  canOperate={operator}
                  isOwn={job.submitted_by === staff.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isStatus(value: string | undefined): value is JobStatus {
  return (
    value === "submitted" ||
    value === "queued" ||
    value === "printing" ||
    value === "post_processing" ||
    value === "ready_for_pickup" ||
    value === "collected" ||
    value === "cancelled"
  );
}
