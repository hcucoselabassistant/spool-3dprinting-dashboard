"use client";

import { useActionState, useEffect, useState } from "react";

import { Field, FormError, Select, SubmitButton, TextInput } from "@/components/form";
import { Modal } from "@/components/modal";
import { formatGrams } from "@/lib/format";

import { finishAttempt, type ActionState } from "./core-actions";

const INITIAL: ActionState = { error: null };

const FAILURE_REASONS = [
  "adhesion",
  "layer_shift",
  "clog",
  "filament_runout",
  "power_loss",
  "model_error",
  "operator_error",
  "other",
] as const;

type Outcome = "success" | "failed" | "cancelled";

/**
 * The highest-value interaction in the product. Every downstream number depends
 * on it being answered honestly, so it is built to resist being dismissed into
 * a non-answer:
 *
 * - Not dismissable by backdrop or Escape -- an outcome must be chosen.
 * - Outcome starts unselected. There is no default that lets someone click
 *   through without deciding.
 * - Actual grams pre-fills the estimate but is required and editable.
 * - Failure reason appears and is required only for a failed outcome.
 */
export function FinishModal({
  attemptId,
  estGrams,
  onClose,
}: {
  attemptId: string;
  estGrams: number;
  onClose: () => void;
}) {
  const [state, action] = useActionState(finishAttempt, INITIAL);
  const [outcome, setOutcome] = useState<Outcome | "">("");

  // Close once the action reports success. Doing this at render would update
  // the parent mid-render of this child, which React rightly complains about.
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal title="Finish print" onClose={onClose} dismissable={false}>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="attempt_id" value={attemptId} />

        <fieldset>
          <legend className="mb-1.5 text-sm text-muted">Outcome</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["success", "failed", "cancelled"] as const).map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm capitalize ${
                  outcome === value
                    ? "border-status-printing bg-status-printing/10"
                    : "border-border hover:bg-surface-raised"
                }`}
              >
                <input
                  type="radio"
                  name="outcome"
                  value={value}
                  className="sr-only"
                  onChange={() => setOutcome(value)}
                  required
                />
                {value}
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          label="Actual grams used"
          hint="Pre-filled with the estimate. Correct it to what the spool actually lost."
        >
          <TextInput
            name="actual_grams"
            type="number"
            min={0}
            defaultValue={estGrams}
            required
          />
        </Field>

        {outcome === "failed" ? (
          <Field label="Why did it fail?">
            <Select name="failure_reason" defaultValue="" required>
              <option value="" disabled>
                Pick a reason
              </option>
              {FAILURE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Notes" hint="Optional">
          <TextInput name="notes" />
        </Field>

        {outcome === "failed" ? (
          <p className="text-xs text-muted">
            Filament is still deducted from the spool on a failure — {""}
            {formatGrams(estGrams)} estimated. This is intentional; the waste has
            to be attributed somewhere.
          </p>
        ) : null}

        <FormError message={state.error} />

        <div className="flex justify-end">
          <SubmitButton>Record outcome</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
