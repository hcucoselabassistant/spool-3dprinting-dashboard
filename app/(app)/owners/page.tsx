import Link from "next/link";

import { canOperate, requireStaff } from "@/lib/auth";
import { getOwners } from "@/lib/queries/owners";

import { InlineCreateOwner, OwnerRow } from "./owner-table";

export const metadata = { title: "Owners · Spool" };

export default async function OwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
  const staff = await requireStaff();
  const params = await searchParams;
  const showInactive = params.inactive === "1";

  const owners = await getOwners(showInactive);
  // TAs can view owners and create them, but editing an existing owner is
  // operator/admin.
  const canEdit = canOperate(staff);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Owners</h1>
        <p className="mt-1 text-sm text-muted">
          {owners.length} owners. Owners do not log in — they are records, not
          users.
        </p>
      </div>

      <div className="mb-4">
        <InlineCreateOwner />
      </div>

      <div className="mb-3">
        <Link
          href={showInactive ? "/owners" : "/owners?inactive=1"}
          className="text-sm text-muted hover:text-foreground"
        >
          {showInactive ? "Hide inactive owners" : "Show inactive owners"}
        </Link>
      </div>

      {owners.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-8 text-center text-muted">
          No owners yet. Add one above — it takes a few seconds.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="grid grid-cols-12 gap-3 border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted">
            <div className="col-span-3">Owner</div>
            <div className="col-span-3">Used / quota</div>
            <div className="col-span-2">Cost</div>
            <div className="col-span-2">Jobs</div>
            <div className="col-span-2" />
          </div>
          {owners.map((owner) => (
            <OwnerRow key={owner.id} owner={owner} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
