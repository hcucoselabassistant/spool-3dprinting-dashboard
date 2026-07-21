import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Printer = Database["public"]["Tables"]["printer"]["Row"];
export type PrinterState = Database["public"]["Enums"]["printer_state"];

export type FleetPrinter = Printer & {
  /** From printer_service_status. Machine hours since the last logged service. */
  hoursSinceService: number;
  lastServiceAt: string | null;
  /** From printer_reliability, 90-day window. Null when there are no attempts. */
  failureRatePct: number | null;
  attempts: number;
  /** The job on this machine right now, if any. */
  currentJob: { id: string; title: string } | null;
};

/**
 * The fleet, ordered by service urgency.
 *
 * Four separate reads merged in TypeScript rather than one embedded query.
 * printer_service_status and printer_reliability are views with no foreign key
 * back to printer, so PostgREST cannot embed them, and the alternative is a
 * hand-written RPC that duplicates logic already living in SQL.
 */
export async function getFleet(): Promise<FleetPrinter[]> {
  const supabase = await createClient();

  const [printers, service, reliability, live] = await Promise.all([
    supabase.from("printer").select("*"),
    supabase.from("printer_service_status").select("*"),
    supabase.from("printer_reliability").select("*"),
    supabase
      .from("attempt")
      .select("printer_id, job(id, title)")
      .is("ended_at", null),
  ]);

  if (printers.error) throw printers.error;
  if (service.error) throw service.error;
  if (reliability.error) throw reliability.error;
  if (live.error) throw live.error;

  const serviceByPrinter = new Map(
    (service.data ?? []).map((row) => [row.printer_id, row]),
  );
  const reliabilityByPrinter = new Map(
    (reliability.data ?? []).map((row) => [row.printer_id, row]),
  );
  const jobByPrinter = new Map(
    (live.data ?? []).flatMap((row) =>
      row.job ? [[row.printer_id, row.job] as const] : [],
    ),
  );

  const fleet: FleetPrinter[] = (printers.data ?? []).map((printer) => ({
    ...printer,
    hoursSinceService: serviceByPrinter.get(printer.id)?.hours_since_service ?? 0,
    lastServiceAt: serviceByPrinter.get(printer.id)?.last_service_at ?? null,
    failureRatePct: reliabilityByPrinter.get(printer.id)?.failure_rate_pct ?? null,
    attempts: reliabilityByPrinter.get(printer.id)?.attempts ?? 0,
    currentJob: jobByPrinter.get(printer.id) ?? null,
  }));

  // Most overdue for service first. Retired machines sink to the bottom --
  // they are kept for historical attempts, not for scheduling.
  return fleet.sort((a, b) => {
    if (a.state === "retired" && b.state !== "retired") return 1;
    if (b.state === "retired" && a.state !== "retired") return -1;
    return serviceRatio(b) - serviceRatio(a);
  });
}

/** 1.0 means exactly due. Above 1.0 is overdue. */
export function serviceRatio(printer: FleetPrinter): number {
  if (printer.service_interval_hours <= 0) return 0;
  return printer.hoursSinceService / printer.service_interval_hours;
}

export function isServiceDue(printer: FleetPrinter): boolean {
  return serviceRatio(printer) >= 1;
}
