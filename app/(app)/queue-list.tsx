"use client";

import { useState } from "react";

import { formatDate, formatGrams, formatMinutes } from "@/lib/format";
import type { ViableSpool } from "@/lib/queries/core";
import type { QueueJob } from "@/lib/queries/floor";

import { StartModal, type PrinterOption } from "./jobs/start-modal";

/**
 * Queued jobs, most urgent first. Selecting a printer opens the start-print
 * confirm with the spool suggestion pre-filled. Assignment happens here rather
 * than on the timeline -- drag-to-reschedule is deferred.
 */
export function QueueList({
  jobs,
  printers,
  spools,
}: {
  jobs: QueueJob[];
  printers: PrinterOption[];
  spools: ViableSpool[];
}) {
  const [starting, setStarting] = useState<QueueJob | null>(null);

  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted">
        Nothing queued.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm"
        >
          <div className="col-span-4">
            <p className="font-medium">
              {job.title}
              {job.priority > 0 ? (
                <span className="ml-2 rounded bg-status-queued/15 px-1.5 py-0.5 text-xs text-status-queued">
                  priority {job.priority}
                </span>
              ) : null}
              {job.hasFailedAttempt ? (
                <span className="ml-2 rounded bg-status-failed/15 px-1.5 py-0.5 text-xs text-status-failed">
                  failed before
                </span>
              ) : null}
              {job.estGrams === null || job.estMinutes === null ? (
                <span className="ml-2 rounded bg-status-maintenance/15 px-1.5 py-0.5 text-xs text-status-maintenance">
                  needs estimate
                </span>
              ) : null}
            </p>
            <p className="text-muted">{job.ownerName}</p>
          </div>
          <div className="col-span-2 text-muted">
            {job.material} · {formatGrams(job.estGrams)}
          </div>
          <div className="col-span-2 text-muted">
            {formatMinutes(job.estMinutes)}
          </div>
          <div className="col-span-2 text-muted">
            {job.neededBy ? `by ${formatDate(job.neededBy)}` : "—"}
          </div>
          <div className="col-span-2 text-right">
            <button
              onClick={() => setStarting(job)}
              disabled={printers.length === 0}
              className="rounded-md bg-status-printing px-3 py-1.5 text-xs font-medium text-background disabled:opacity-40"
              title={
                printers.length === 0 ? "No printer available" : "Assign a printer"
              }
            >
              Assign printer
            </button>
          </div>
        </div>
      ))}

      {starting ? (
        <StartModal
          jobId={starting.id}
          material={starting.material}
          estMinutes={starting.estMinutes}
          estGrams={starting.estGrams}
          printers={printers}
          spools={spools}
          onClose={() => setStarting(null)}
        />
      ) : null}
    </div>
  );
}
