import { requireStaff } from "@/lib/auth";

export default async function FloorPage() {
  const staff = await requireStaff();

  return (
    <div className="mx-auto max-w-2xl py-12">
      <h1 className="text-xl font-semibold tracking-tight">
        Signed in as {staff.full_name}
      </h1>
      <p className="mt-2 text-muted">
        Phase 1 is schema and auth only. The floor view — summary strip, printer
        timeline, needs-attention list, and unassigned queue — is Phase 5.
      </p>
      <p className="mt-4 text-sm text-muted">
        Next up is Phase 2: printers and inventory. See{" "}
        <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs">
          spec/04-build-plan.md
        </code>
        .
      </p>
    </div>
  );
}
