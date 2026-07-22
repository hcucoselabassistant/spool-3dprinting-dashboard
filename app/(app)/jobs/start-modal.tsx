"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { Field, FormError, Select, SubmitButton, TextInput } from "@/components/form";
import { Modal } from "@/components/modal";
import { formatCostPerGram, formatGrams } from "@/lib/format";
import type { ViableSpool } from "@/lib/queries/core";

import { startPrint, type ActionState } from "./core-actions";

const INITIAL: ActionState = { error: null };

export type PrinterOption = { id: string; name: string; model: string };

/**
 * Start a print and -- for a job whose slice the operator is looking at for the
 * first time -- record the estimate everything downstream is scheduled against.
 *
 * The fields are pre-filled when the estimate was given at approval, and stay
 * editable: re-slicing a job that failed is normal, and the number in front of
 * the operator now is the true one.
 *
 * The spool list narrows as grams are typed, because "which spools can cover
 * this" has no answer until it knows how big the print is.
 */
export function StartModal({
  jobId,
  material,
  estMinutes,
  estGrams,
  printers,
  spools,
  onClose,
}: {
  jobId: string;
  material: string;
  estMinutes: number | null;
  estGrams: number | null;
  printers: PrinterOption[];
  spools: ViableSpool[];
  onClose: () => void;
}) {
  const [state, action] = useActionState(startPrint, INITIAL);
  const [minutes, setMinutes] = useState(estMinutes?.toString() ?? "");
  const [grams, setGrams] = useState(estGrams?.toString() ?? "");

  const parsed = Number.parseInt(grams, 10);
  const gramsNeeded = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  // Same rule the server suggestion query uses: right material, covers the
  // estimate, least-remaining first to burn down partial spools. Until grams
  // are typed, every spool of the material is still on the table.
  const suggestions = useMemo(
    () =>
      spools
        .filter(
          (s) => s.material === material && s.remaining_grams >= (gramsNeeded ?? 0),
        )
        .sort((a, b) => a.remaining_grams - b.remaining_grams),
    [spools, material, gramsNeeded],
  );

  // The suggestion list moves as grams are typed, so the selection is derived
  // rather than stored: keep the operator's spool while it can still cover the
  // print, otherwise fall back to the least-full one that can.
  const [chosenSpoolId, setChosenSpoolId] = useState("");
  const spoolId = suggestions.some((s) => s.id === chosenSpoolId)
    ? chosenSpoolId
    : (suggestions[0]?.id ?? "");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal title="Start print" onClose={onClose}>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="job_id" value={jobId} />

        <p className="text-sm text-muted">
          {material}
          {gramsNeeded !== null ? ` · needs ${formatGrams(gramsNeeded)}` : null}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Estimated minutes" hint="From the slicer">
            <TextInput
              name="est_minutes"
              type="number"
              min={1}
              required
              autoFocus={estMinutes === null}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </Field>
          <Field label="Estimated grams" hint="From the slicer">
            <TextInput
              name="est_grams"
              type="number"
              min={1}
              required
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
            />
          </Field>
        </div>

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
              No {material} spool has{" "}
              {gramsNeeded !== null ? formatGrams(gramsNeeded) : "filament"} left.
              Add or refill one in inventory.
            </p>
          ) : (
            <Select
              name="spool_id"
              value={spoolId}
              onChange={(e) => setChosenSpoolId(e.target.value)}
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

        {/* Quota warns, never blocks. It surfaces here rather than at approval
            when this is where the estimate was first entered. */}
        {state.quotaWarning ? (
          <div className="rounded-md border border-status-maintenance/40 bg-status-maintenance/10 px-3 py-2 text-sm">
            <p>{state.quotaWarning}</p>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" name="override" value="true" />
              <span>Start anyway</span>
            </label>
          </div>
        ) : null}

        <FormError message={state.error} />

        <div className="flex justify-end">
          <SubmitButton>Start print</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
