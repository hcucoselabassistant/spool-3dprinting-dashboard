"use client";

import { useState } from "react";
import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import { formatHours } from "@/lib/format";
import type { FleetPrinter } from "@/lib/queries/printers";

import { EditPrinterForm, PrinterStateControl } from "./printer-form";

export function PrinterCard({
  printer,
  isAdmin,
}: {
  printer: FleetPrinter;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const ratio =
    printer.service_interval_hours > 0
      ? printer.hoursSinceService / printer.service_interval_hours
      : 0;
  const overdue = ratio >= 1;

  return (
    <div
      className={`rounded-lg border bg-surface p-4 ${
        overdue ? "border-status-maintenance/50" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            {printer.name}
          </h3>
          <p className="text-sm text-muted">{printer.model}</p>
        </div>
        <StatusPill status={printer.state} />
      </div>

      {printer.currentJob ? (
        <Link
          href={`/jobs/${printer.currentJob.id}`}
          className="mt-3 block truncate text-sm text-status-printing hover:underline"
        >
          Printing: {printer.currentJob.title}
        </Link>
      ) : null}

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">Since service</span>
          <span className={overdue ? "text-status-maintenance" : ""}>
            {formatHours(printer.hoursSinceService)} /{" "}
            {formatHours(printer.service_interval_hours)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-raised">
          <div
            className={`h-full rounded-full ${
              overdue ? "bg-status-maintenance" : "bg-status-printing"
            }`}
            style={{ width: `${Math.min(100, ratio * 100)}%` }}
          />
        </div>
        {overdue ? (
          <p className="mt-1.5 text-xs text-status-maintenance">
            Service due. This does not stop prints — set the printer to
            maintenance to do that.
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline justify-between text-sm">
        <span className="text-muted">Failure rate (90d)</span>
        <span>
          {printer.attempts === 0
            ? "no attempts yet"
            : `${printer.failureRatePct ?? 0}% of ${printer.attempts}`}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        <PrinterStateControl printer={printer} canRetire={isAdmin} />
        {isAdmin && !editing ? (
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            Edit
          </button>
        ) : null}
      </div>

      {editing ? (
        <EditPrinterForm printer={printer} onDone={() => setEditing(false)} />
      ) : null}
    </div>
  );
}
