"use client";

import { useFormStatus } from "react-dom";

// Shared form chrome. The lab screens are read from about two metres away, so
// controls stay large and high-contrast rather than compact.

const FIELD =
  "rounded-md border border-border bg-surface-raised px-3 py-2 text-base outline-none focus:border-status-printing disabled:opacity-50";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <input {...props} className={`${FIELD} ${props.className ?? ""}`} />;
}

export function Select(props: React.ComponentProps<"select">) {
  return <select {...props} className={`${FIELD} ${props.className ?? ""}`} />;
}

export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-status-printing text-background",
    secondary: "border border-border text-foreground hover:bg-surface-raised",
    danger: "border border-status-failed/40 text-status-failed hover:bg-status-failed/10",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50 ${styles}`}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-status-failed/40 bg-status-failed/10 px-3 py-2 text-sm text-status-failed"
    >
      {message}
    </p>
  );
}
