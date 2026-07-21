import Link from "next/link";

import type { FloorData } from "@/lib/queries/floor";

/**
 * Four counts across the top, each a link into the filtered view it summarises.
 * Big and high-contrast -- this is read from across the room off a wall monitor.
 */
export function SummaryStrip({ summary }: { summary: FloorData["summary"] }) {
  const cells = [
    { label: "Printing now", value: summary.printing, href: "/jobs", tone: "text-status-printing" },
    { label: "In queue", value: summary.queued, href: "/jobs", tone: "text-status-queued" },
    { label: "Awaiting pickup", value: summary.awaitingPickup, href: "/jobs", tone: "text-status-ready" },
    { label: "Printers down", value: summary.down, href: "/printers", tone: summary.down > 0 ? "text-status-maintenance" : "text-muted" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cells.map((cell) => (
        <Link
          key={cell.label}
          href={cell.href}
          className="rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-raised"
        >
          <div className={`text-3xl font-semibold tabular-nums ${cell.tone}`}>
            {cell.value}
          </div>
          <div className="mt-1 text-sm text-muted">{cell.label}</div>
        </Link>
      ))}
    </div>
  );
}
