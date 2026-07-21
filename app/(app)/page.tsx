import { requireStaff } from "@/lib/auth";
import { getAvailablePrinters, getViableSpools } from "@/lib/queries/core";
import { getFloorData } from "@/lib/queries/floor";

import { NeedsAttention } from "./needs-attention";
import { QueueList } from "./queue-list";
import { SummaryStrip } from "./summary-strip";
import { Timeline } from "./timeline";

// The screen a TA leaves open all shift. Kept dynamic and always fresh; the
// RealtimeRefresh in the layout re-fetches this on any attempt/job change.
export const dynamic = "force-dynamic";

export default async function FloorPage() {
  await requireStaff();

  const [floor, printers, spools] = await Promise.all([
    getFloorData(),
    getAvailablePrinters(),
    getViableSpools(),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <SummaryStrip summary={floor.summary} />

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Next 12 hours
        </h2>
        <Timeline rows={floor.timeline} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Needs attention
        </h2>
        <NeedsAttention items={floor.attention} printers={printers} spools={spools} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Unassigned queue
        </h2>
        <QueueList jobs={floor.queue} printers={printers} spools={spools} />
      </section>
    </div>
  );
}
