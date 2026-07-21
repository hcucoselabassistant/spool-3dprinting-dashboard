"use client";

import { useEffect } from "react";

/**
 * A blocking modal. The finish-print dialog depends on this actually blocking:
 * the operator has to choose an outcome, not dismiss it into an unrecorded
 * state. Only `dismissable` dialogs close on backdrop click or Escape.
 */
export function Modal({
  title,
  onClose,
  dismissable = true,
  children,
}: {
  title: string;
  onClose: () => void;
  dismissable?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!dismissable) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissable, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-surface p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          {dismissable ? (
            <button
              onClick={onClose}
              className="text-muted hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
