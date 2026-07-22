import Link from "next/link";

import { mustChangePassword, requireStaff } from "@/lib/auth";

import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Change password · Spool" };

export default async function ChangePasswordPage() {
  const staff = await requireStaff();
  const forced = await mustChangePassword();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {forced ? "Set your password" : "Change password"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {forced
              ? `Welcome, ${staff.full_name}. Choose a password of your own before continuing — the one you were given is temporary.`
              : "Choose a new password for your account."}
          </p>
        </div>

        <ChangePasswordForm />

        {!forced ? (
          <div className="mt-6">
            <Link href="/" className="text-sm text-muted hover:text-foreground">
              ← Back
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
