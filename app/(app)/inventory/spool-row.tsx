"use client";

import { useState } from "react";

import { LOW_SPOOL_GRAMS } from "@/lib/config";
import { formatCostPerGram, formatGrams } from "@/lib/format";
import type { Spool } from "@/lib/queries/spools";

import { EditSpoolForm, RetireSpoolButton } from "./spool-form";

export function SpoolRow({
  spool,
  isAdmin,
}: {
  spool: Spool;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const pct =
    spool.total_grams > 0
      ? Math.min(100, (spool.remaining_grams / spool.total_grams) * 100)
      : 0;
  const low = spool.remaining_grams <= LOW_SPOOL_GRAMS;

  return (
    <div
      className={`rounded-lg border bg-surface p-4 ${
        low && !spool.retired ? "border-status-maintenance/50" : "border-border"
      } ${spool.retired ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {spool.color_hex ? (
            <span
              aria-hidden
              className="size-5 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: spool.color_hex }}
            />
          ) : null}
          <div>
            <p className="font-medium">{spool.color_name}</p>
            <p className="text-sm text-muted">
              {spool.brand ?? "unbranded"}
              {spool.retired ? " · retired" : ""}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={low ? "text-status-maintenance" : ""}>
            {formatGrams(spool.remaining_grams)}
          </p>
          <p className="text-sm text-muted">
            of {formatGrams(spool.total_grams)}
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-raised">
        <div
          className={`h-full rounded-full ${
            low ? "bg-status-maintenance" : "bg-status-ready"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-sm text-muted">
          {formatCostPerGram(spool.cost_cents, spool.total_grams)}
        </span>
        {isAdmin ? (
          <div className="flex items-end gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
              >
                Edit
              </button>
            ) : null}
            <RetireSpoolButton spool={spool} />
          </div>
        ) : null}
      </div>

      {editing ? (
        <EditSpoolForm spool={spool} onDone={() => setEditing(false)} />
      ) : null}
    </div>
  );
}
