import { requireStaff } from "@/lib/auth";
import { getFleet, getMaintenanceLogs } from "@/lib/queries/printers";

import { AddPrinterForm } from "./printer-form";
import { PrinterCard } from "./printer-card";

export const metadata = { title: "Printers · Spool" };

export default async function PrintersPage() {
  const staff = await requireStaff();
  const [fleet, maintenance] = await Promise.all([
    getFleet(),
    getMaintenanceLogs(),
  ]);

  const isAdmin = staff.role === "admin";
  const due = fleet.filter(
    (p) =>
      p.state !== "retired" &&
      p.service_interval_hours > 0 &&
      p.hoursSinceService / p.service_interval_hours >= 1,
  ).length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Printers</h1>
          <p className="mt-1 text-sm text-muted">
            {fleet.length} machines
            {due > 0 ? ` · ${due} past service interval` : ""}
          </p>
        </div>
        {isAdmin ? <AddPrinterForm /> : null}
      </div>

      {fleet.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-8 text-center text-muted">
          {isAdmin
            ? "No printers yet. Add your machines — everything downstream needs real printers to point at."
            : "No printers yet. An administrator needs to add them."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fleet.map((printer) => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              isAdmin={isAdmin}
              maintenance={maintenance.get(printer.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
