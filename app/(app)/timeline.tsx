"use client";

import { useEffect, useState } from "react";

import { formatMinutes } from "@/lib/format";
import type { TimelineRow } from "@/lib/queries/floor";

import { FinishModal } from "./jobs/finish-modal";

const WINDOW_MINUTES = 12 * 60;

/**
 * Printers down the left, the next 12 hours across. One row per printer.
 * Read-mostly in v1: clicking a live bar opens the finish modal. There are no
 * scheduled (outlined) bars yet -- starting a print makes an attempt live
 * immediately, so nothing sits on the timeline unstarted. That returns if a
 * real scheduling feature lands.
 */
export function Timeline({ rows }: { rows: TimelineRow[] }) {
  // A ticking clock so progress advances without a refresh. One minute is fine
  // for a 12-hour window read from across the room.
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState<TimelineRow["attempt"] | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex border-b border-border text-xs text-muted">
        <div className="w-28 shrink-0 px-3 py-2">Printer</div>
        <div className="relative flex-1">
          {[0, 3, 6, 9, 12].map((h) => (
            <span
              key={h}
              className="absolute top-2 -translate-x-1/2"
              style={{ left: `${(h / 12) * 100}%` }}
            >
              {h === 0 ? "now" : `+${h}h`}
            </span>
          ))}
          <div className="py-2">&nbsp;</div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.printerId} className="flex items-center">
            <div className="w-28 shrink-0 truncate px-3 py-2.5 text-sm font-medium">
              {row.printerName}
            </div>
            <div className="relative h-9 flex-1">
              <TrackContent row={row} now={now} onFinish={setFinishing} />
            </div>
          </div>
        ))}
      </div>

      {finishing ? (
        <FinishModal
          attemptId={finishing.id}
          estGrams={finishing.estGrams}
          onClose={() => setFinishing(null)}
        />
      ) : null}
    </div>
  );
}

function TrackContent({
  row,
  now,
  onFinish,
}: {
  row: TimelineRow;
  now: number;
  onFinish: (attempt: TimelineRow["attempt"]) => void;
}) {
  if (row.state === "maintenance") {
    return (
      <div className="absolute inset-y-1.5 inset-x-1 flex items-center justify-center rounded bg-status-maintenance/15 text-xs text-status-maintenance">
        maintenance
      </div>
    );
  }

  if (!row.attempt) {
    return (
      <div className="absolute inset-y-1.5 inset-x-1 rounded border border-dashed border-border/60" />
    );
  }

  const started = new Date(row.attempt.startedAt).getTime();
  const end = new Date(row.attempt.expectedEnd).getTime();
  const total = Math.max(1, end - started);
  const pct = Math.min(100, Math.max(0, ((now - started) / total) * 100));
  const remainingMin = (end - now) / 60_000;
  const overdue = now > end;

  // Bar spans from now to expected end, as a fraction of the 12h window.
  const widthPct = overdue
    ? 100
    : Math.min(100, Math.max(4, (remainingMin / WINDOW_MINUTES) * 100));

  return (
    <button
      onClick={() => onFinish(row.attempt)}
      title="Finish this print"
      className={`absolute inset-y-1.5 left-1 overflow-hidden rounded text-left text-xs ${
        overdue
          ? "bg-status-failed/25 ring-1 ring-status-failed"
          : "bg-status-printing/20"
      }`}
      style={{ width: `calc(${widthPct}% - 0.5rem)` }}
    >
      {!overdue ? (
        <span
          className="absolute inset-y-0 left-0 bg-status-printing/30"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      ) : null}
      <span className="relative flex h-full items-center gap-1.5 px-2 truncate">
        <span className="truncate font-medium">{row.attempt.jobTitle}</span>
        <span className={overdue ? "text-status-failed" : "text-muted"}>
          {overdue
            ? `overdue ${formatMinutes(Math.round(-remainingMin))}`
            : `${Math.round(pct)}% · ${formatMinutes(Math.max(0, Math.round(remainingMin)))} left`}
        </span>
      </span>
    </button>
  );
}
