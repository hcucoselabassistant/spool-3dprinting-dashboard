"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { changePassword, type ActionState } from "./actions";

const INITIAL: ActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-status-printing px-4 py-2.5 text-base font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Set new password"}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">New password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          autoFocus
          className="rounded-md border border-border bg-surface-raised px-3 py-2.5 text-base outline-none focus:border-status-printing"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Confirm new password</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
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
