import type { Database } from "@/lib/database.types";

type PrinterState = Database["public"]["Enums"]["printer_state"];
type JobStatus = Database["public"]["Enums"]["job_status"];

export type Status = PrinterState | JobStatus;

// spec/03-screens.md: status colour is consistent everywhere and defined once.
// These map to the tokens in globals.css -- never write a hex at a call site.
const STYLES: Record<Status, string> = {
  available: "bg-status-ready/15 text-status-ready",
  printing: "bg-status-printing/15 text-status-printing",
  maintenance: "bg-status-maintenance/15 text-status-maintenance",
  retired: "bg-status-collected/15 text-status-collected",

  submitted: "bg-status-submitted/15 text-status-submitted",
  queued: "bg-status-queued/15 text-status-queued",
  post_processing: "bg-status-printing/15 text-status-printing",
  ready_for_pickup: "bg-status-ready/15 text-status-ready",
  collected: "bg-status-collected/15 text-status-collected",
  cancelled: "bg-status-failed/15 text-status-failed",
};

const LABELS: Partial<Record<Status, string>> = {
  post_processing: "post-processing",
  ready_for_pickup: "ready",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
