import Link from "next/link";

import { requireStaff } from "@/lib/auth";
import { LOW_SPOOL_GRAMS } from "@/lib/config";
import { formatGrams } from "@/lib/format";
import { getSpools } from "@/lib/queries/spools";

import { AddSpoolForm } from "./spool-form";
import { SpoolRow } from "./spool-row";

export const metadata = { title: "Inventory · Spool" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ retired?: string }>;
}) {
  const staff = await requireStaff();
  const params = await searchParams;
  const showRetired = params.retired === "1";

  const groups = await getSpools(showRetired);
  const isAdmin = staff.role === "admin";

  const all = groups.flatMap((g) => g.spools);
  const low = all.filter((s) => !s.retired && s.remaining_grams <= LOW_SPOOL_GRAMS);
  const totalRemaining = all
    .filter((s) => !s.retired)
    .reduce((sum, s) => sum + s.remaining_grams, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-muted">
            {formatGrams(totalRemaining)} on hand
            {low.length > 0
              ? ` · ${low.length} spool${low.length === 1 ? "" : "s"} under ${formatGrams(LOW_SPOOL_GRAMS)}`
              : ""}
          </p>
        </div>
        {isAdmin ? <AddSpoolForm /> : null}
      </div>

      <div className="mb-4">
        <Link
          href={showRetired ? "/inventory" : "/inventory?retired=1"}
          className="text-sm text-muted hover:text-foreground"
        >
          {showRetired ? "Hide retired spools" : "Show retired spools"}
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-8 text-center text-muted">
          {isAdmin
            ? "No spools yet. Add the filament you actually have on the shelf."
            : "No spools yet. An administrator needs to add them."}
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.material}>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
                {group.material}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.spools.map((spool) => (
                  <SpoolRow key={spool.id} spool={spool} isAdmin={isAdmin} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
