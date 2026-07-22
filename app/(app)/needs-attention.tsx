"use client";

import { useState } from "react";
import Link from "next/link";

import { formatDateTime, formatGrams } from "@/lib/format";
import type { AttentionItem } from "@/lib/queries/floor";
import type { ViableSpool } from "@/lib/queries/core";

import { FinishModal } from "./jobs/finish-modal";
import { StartModal, type PrinterOption } from "./jobs/start-modal";

/**
 * One list, heterogeneous, ordered by urgency. Each row carries exactly one
 * primary action -- the TA reads down it and works. Not five separate panels.
 */
export function NeedsAttention({
  items,
  printers,
  spools,
}: {
  items: AttentionItem[];
  printers: PrinterOption[];
  spools: ViableSpool[];
}) {
  const [finish, setFinish] = useState<{
    id: string;
    grams: number | null;
  } | null>(null);
  const [start, setStart] = useState<{
    jobId: string;
    material: string;
    minutes: number | null;
    grams: number | null;
  } | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted">
        Nothing needs attention. The floor is clear.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {items.map((item) => (
        <div
          key={rowKey(item)}
          className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
        >
          <Description item={item} />
          <div className="shrink-0">
            {item.kind === "overdue_attempt" ? (
              <button
                onClick={() =>
                  setFinish({ id: item.attemptId, grams: item.estGrams })
                }
                className="rounded-md bg-status-printing px-3 py-1.5 text-xs font-medium text-background"
              >
                Log outcome
              </button>
            ) : null}

            {item.kind === "failed_job" ? (
              <button
                onClick={() =>
                  setStart({
                    jobId: item.jobId,
                    material: item.material,
                    minutes: item.estMinutes,
                    grams: item.estGrams,
                  })
                }
                className="rounded-md bg-status-printing px-3 py-1.5 text-xs font-medium text-background"
              >
                Re-assign
              </button>
            ) : null}

            {item.kind === "stale_pickup" ? (
              item.ownerEmail ? (
                <a
                  href={pickupMailto(item)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-raised"
                >
                  Notify
                </a>
              ) : (
                <span className="text-xs text-muted">no email on file</span>
              )
            ) : null}

            {item.kind === "low_spool" ? (
              <Link
                href="/inventory"
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-raised"
              >
                Inventory
              </Link>
            ) : null}

            {item.kind === "service_due" ? (
              <Link
                href="/printers"
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-raised"
              >
                Printers
              </Link>
            ) : null}
          </div>
        </div>
      ))}

      {finish ? (
        <FinishModal
          attemptId={finish.id}
          estGrams={finish.grams}
          onClose={() => setFinish(null)}
        />
      ) : null}

      {start ? (
        <StartModal
          jobId={start.jobId}
          material={start.material}
          estMinutes={start.minutes}
          estGrams={start.grams}
          printers={printers}
          spools={spools}
          onClose={() => setStart(null)}
        />
      ) : null}
    </div>
  );
}

function Description({ item }: { item: AttentionItem }) {
  switch (item.kind) {
    case "overdue_attempt":
      return (
        <div>
          <p className="font-medium text-status-failed">Print past its estimate</p>
          <p className="text-muted">
            {item.jobTitle} on {item.printerName} · expected{" "}
            {formatDateTime(item.expectedEnd)}. Probably done — log the outcome.
          </p>
        </div>
      );
    case "failed_job":
      return (
        <div>
          <p className="font-medium text-status-queued">Failed, awaiting re-run</p>
          <p className="text-muted">
            {item.jobTitle} · {item.ownerName} · {item.material},{" "}
            {formatGrams(item.estGrams)}
          </p>
        </div>
      );
    case "stale_pickup":
      return (
        <div>
          <p className="font-medium text-status-ready">Uncollected</p>
          <p className="text-muted">
            {item.jobTitle} · {item.ownerName}
            {item.shelf ? ` · shelf ${item.shelf}` : ""} · ready since{" "}
            {formatDateTime(item.readySince)}
          </p>
        </div>
      );
    case "low_spool":
      return (
        <div>
          <p className="font-medium text-status-maintenance">Spool low</p>
          <p className="text-muted">
            {item.material} {item.colorName} · {formatGrams(item.remaining)} left
          </p>
        </div>
      );
    case "service_due":
      return (
        <div>
          <p className="font-medium text-status-maintenance">Service due</p>
          <p className="text-muted">
            {item.printerName} · {Math.round(item.hours)}h since service, interval{" "}
            {item.interval}h
          </p>
        </div>
      );
  }
}

function rowKey(item: AttentionItem): string {
  switch (item.kind) {
    case "overdue_attempt":
      return `overdue-${item.attemptId}`;
    case "failed_job":
      return `failed-${item.jobId}`;
    case "stale_pickup":
      return `pickup-${item.jobId}`;
    case "low_spool":
      return `spool-${item.spoolId}`;
    case "service_due":
      return `service-${item.printerId}`;
  }
}

/**
 * v1 pickup notice is a mailto -- real delivery is out of scope, but the action
 * exists so a provider can slot in behind it. See spec/02-workflows.md.
 */
function pickupMailto(item: Extract<AttentionItem, { kind: "stale_pickup" }>): string {
  const subject = encodeURIComponent(`Your 3D print is ready: ${item.jobTitle}`);
  const body = encodeURIComponent(
    `Hi ${item.ownerName},\n\nYour print "${item.jobTitle}" is ready for pickup` +
      (item.shelf ? ` on shelf ${item.shelf}` : "") +
      `.\n\nThanks,\nThe print lab`,
  );
  return `mailto:${item.ownerEmail}?subject=${subject}&body=${body}`;
}
