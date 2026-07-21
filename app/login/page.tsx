import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Spool" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Spool</h1>
          <p className="mt-1 text-sm text-muted">
            3D print farm operations. Staff only.
          </p>
        </div>

        {params.error === "not-staff" ? (
          <p
            role="alert"
            className="mb-4 rounded-md border border-status-failed/40 bg-status-failed/10 px-3 py-2 text-sm text-status-failed"
          >
            That account is not an active staff member. Ask an administrator to
            add you.
          </p>
        ) : null}

        <LoginForm next={next} />
      </div>
    </main>
  );
}
