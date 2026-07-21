import Link from "next/link";

import { requireStaff } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

import { RealtimeRefresh } from "./realtime-refresh";

// Routes are fixed at six -- spec/03-screens.md says resist adding a seventh.
// The ones not yet built are added in their own phases.
const NAV = [
  { href: "/", label: "Floor" },
  { href: "/jobs", label: "Jobs" },
  { href: "/printers", label: "Printers" },
  { href: "/inventory", label: "Inventory" },
  { href: "/owners", label: "Owners" },
  { href: "/reports", label: "Reports" },
] as const;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="flex items-center gap-6 px-6 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Spool
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted">
              {staff.full_name}
              {staff.role === "admin" ? " · admin" : ""}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">{children}</main>
      <RealtimeRefresh />
    </div>
  );
}
