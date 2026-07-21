import { requireOperator } from "@/lib/auth";
import { formatCents, formatGrams } from "@/lib/format";
import { getCostReport, getReliability } from "@/lib/queries/reports";
import type { CostRow } from "@/lib/queries/reports";

export const metadata = { title: "Reports · Spool" };
export const dynamic = "force-dynamic";

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function ReportsPage() {
  // Reports cover printers and cost -- operator/admin only.
  await requireOperator();

  const [months, reliability] = await Promise.all([
    getCostReport(),
    getReliability(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted">
          Filament cost by month, and printer reliability. Cost includes failed
          prints — that filament was still spent.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Monthly filament cost
        </h2>

        {months.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted">
            No finished prints yet, so nothing to cost.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {months.map((month) => (
              <div
                key={month.month}
                className="overflow-hidden rounded-lg border border-border bg-surface"
              >
                <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
                  <h3 className="font-semibold">{monthLabel(month.month)}</h3>
                  <span className="text-sm text-muted">
                    {formatGrams(month.totalGrams)} ·{" "}
                    <span className="font-medium text-foreground">
                      {formatCents(month.totalCents)}
                    </span>
                  </span>
                </div>
                <div className="grid gap-6 p-4 sm:grid-cols-2">
                  <CostBreakdown title="By owner" rows={month.byOwner} />
                  <CostBreakdown title="By course" rows={month.byCourse} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Printer reliability (90 days)
        </h2>
        {reliability.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted">
            No printers.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="grid grid-cols-12 gap-3 border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-muted">
              <div className="col-span-4">Printer</div>
              <div className="col-span-2 text-right">Attempts</div>
              <div className="col-span-2 text-right">Failures</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Wasted</div>
            </div>
            {reliability.map((row) => (
              <div
                key={row.printerName}
                className="grid grid-cols-12 gap-3 border-b border-border px-4 py-2.5 text-sm last:border-b-0"
              >
                <div className="col-span-4 font-medium">{row.printerName}</div>
                <div className="col-span-2 text-right tabular-nums">
                  {row.attempts}
                </div>
                <div className="col-span-2 text-right tabular-nums">
                  {row.failures}
                </div>
                <div
                  className={`col-span-2 text-right tabular-nums ${
                    row.failureRatePct >= 20 ? "text-status-failed" : ""
                  }`}
                >
                  {row.attempts === 0 ? "—" : `${row.failureRatePct}%`}
                </div>
                <div className="col-span-2 text-right tabular-nums text-muted">
                  {row.wastedGrams > 0 ? formatGrams(row.wastedGrams) : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CostBreakdown({ title, rows }: { title: string; rows: CostRow[] }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-muted">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-baseline justify-between text-sm">
            <span className="truncate pr-2">{row.label}</span>
            <span className="shrink-0 tabular-nums">
              <span className="text-muted">{formatGrams(row.grams)}</span>{" "}
              <span className="font-medium">{formatCents(row.cents)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
