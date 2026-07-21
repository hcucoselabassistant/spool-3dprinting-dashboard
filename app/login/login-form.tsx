"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-status-printing px-4 py-2.5 text-base font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className="rounded-md border border-border bg-surface-raised px-3 py-2.5 text-base outline-none focus:border-status-printing"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-border bg-surface-raised px-3 py-2.5 text-base outline-none focus:border-status-printing"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-status-failed">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
