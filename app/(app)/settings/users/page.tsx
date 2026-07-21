import { requireAdmin } from "@/lib/auth";
import { getStaff } from "@/lib/queries/staff";

import { CreateStaffForm, StaffRowControls } from "./user-admin";

export const metadata = { title: "Users · Spool" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAdmin();
  const staff = await getStaff();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Staff accounts</h1>
        <p className="mt-1 text-sm text-muted">
          Create accounts and set roles. New accounts start as TA. Deactivating
          keeps history intact — accounts are never deleted.
        </p>
      </div>

      <div className="mb-8">
        <CreateStaffForm />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-12 gap-3 border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-muted">
          <div className="col-span-5">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-4 text-right">Role</div>
        </div>
        {staff.map((user) => (
          <div
            key={user.id}
            className={`grid grid-cols-12 items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0 ${
              user.active ? "" : "opacity-60"
            }`}
          >
            <div className="col-span-5">
              <p className="font-medium">
                {user.full_name}
                {user.active ? "" : " · inactive"}
              </p>
            </div>
            <div className="col-span-3 truncate text-muted">{user.email}</div>
            <div className="col-span-4">
              <StaffRowControls user={user} isSelf={user.id === me.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
