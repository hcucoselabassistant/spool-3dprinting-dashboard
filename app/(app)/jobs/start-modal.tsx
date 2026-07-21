"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { Field, FormError, Select, SubmitButton } from "@/components/form";
import { Modal } from "@/components/modal";
import { formatCostPerGram, formatGrams } from "@/lib/format";
import type { ViableSpool } from "@/lib/queries/core";

import { startPrint, type ActionState } from "./core-actions";

const INITIAL: ActionState = { error: null };

export type PrinterOption = { id: string; name: string; model: string };

export function StartModal({
  jobId,
  material,
  estGrams,
  printers,
  spools,
  onClose,
}: {
  jobId: string;
  material: string;
  estGrams: number;
  printers: PrinterOption[];
  spools: ViableSpool[];
  onClose: () => void;
}) {
  const [state, action] = useActionState(startPrint, INITIAL);

  // Same rule the server suggestion query uses: right material, covers the
  // estimate, least-remaining first to burn down partial spools.
  const suggestions = useMemo(
    () =>
      spools
        .filter((s) => s.material === material && s.remaining_grams >= estGrams)
        .sort((a, b) => a.remaining_grams - b.remaining_grams),
    [spools, material, estGrams],
  );

  const [spoolId, setSpoolId] = useState(suggestions[0]?.id ?? "");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal title="Start print" onClose={onClose}>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="job_id" value={jobId} />

        <p className="text-sm text-muted">
          {material} · needs {formatGrams(estGrams)}
        </p>

        <Field label="Printer">
          <Select name="printer_id" defaultValue="" required>
            <option value="" disabled>
              {printers.length === 0
                ? "No printer is available"
                : "Pick a printer"}
            </option>
            {printers.map((printer) => (
              <option key={printer.id} value={printer.id}>
                {printer.name} · {printer.model}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Spool"
          hint="Suggested least-full first, so partial spools get used up."
        >
          {suggestions.length === 0 ? (
            <p className="rounded-md border border-status-maintenance/40 bg-status-maintenance/10 px-3 py-2 text-sm text-status-maintenance">
              No {material} spool has {formatGrams(estGrams)} left. Add or refill
              one in inventory.
            </p>
          ) : (
            <Select
              name="spool_id"
              value={spoolId}
              onChange={(e) => setSpoolId(e.target.value)}
              required
            >
              {suggestions.map((spool) => (
                <option key={spool.id} value={spool.id}>
                  {spool.color_name}
                  {spool.brand ? ` (${spool.brand})` : ""} ·{" "}
                  {formatGrams(spool.remaining_grams)} left ·{" "}
                  {formatCostPerGram(spool.cost_cents, spool.total_grams)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <FormError message={state.error} />

        <div className="flex justify-end">
          <SubmitButton>Start print</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
