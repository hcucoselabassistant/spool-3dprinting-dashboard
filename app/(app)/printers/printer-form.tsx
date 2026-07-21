"use client";

import { useActionState, useState } from "react";

import { Field, FormError, Select, SubmitButton, TextInput } from "@/components/form";
import type { Printer } from "@/lib/queries/printers";

import {
  createPrinter,
  setPrinterState,
  updatePrinter,
  type ActionState,
} from "./actions";

const INITIAL: ActionState = { error: null };

export function AddPrinterForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createPrinter, INITIAL);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-status-printing px-4 py-2 text-sm font-medium text-background"
      >
        Add printer
      </button>
    );
  }

  return (
    <form
      action={action}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <h2 className="mb-4 font-medium">Add printer</h2>
      <PrinterFields />
      <FormError message={state.error} />
      <div className="mt-4 flex gap-2">
        <SubmitButton>Add printer</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function EditPrinterForm({
  printer,
  onDone,
}: {
  printer: Printer;
  onDone: () => void;
}) {
  const [state, action] = useActionState(updatePrinter, INITIAL);

  return (
    <form action={action} className="mt-3 border-t border-border pt-3">
      <input type="hidden" name="id" value={printer.id} />
      <PrinterFields printer={printer} />
      <FormError message={state.error} />
      <div className="mt-3 flex gap-2">
        <SubmitButton>Save</SubmitButton>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function PrinterFields({ printer }: { printer?: Printer }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Name" hint="The label on the machine, e.g. mk4-01">
        <TextInput name="name" defaultValue={printer?.name} required />
      </Field>
      <Field label="Model">
        <TextInput
          name="model"
          defaultValue={printer?.model}
          placeholder="Prusa MK4"
          required
        />
      </Field>
      <Field label="Service interval (hours)">
        <TextInput
          name="service_interval_hours"
          type="number"
          min={1}
          defaultValue={printer?.service_interval_hours ?? 250}
          required
        />
      </Field>
      <Field label="Nozzle (mm)">
        <TextInput
          name="nozzle_mm"
          type="number"
          step="0.1"
          min="0.1"
          defaultValue={printer?.nozzle_mm ?? 0.4}
        />
      </Field>
      <Field label="Build volume">
        <TextInput
          name="build_volume"
          defaultValue={printer?.build_volume ?? ""}
          placeholder="250 × 210 × 220 mm"
        />
      </Field>
      <Field label="Notes">
        <TextInput name="notes" defaultValue={printer?.notes ?? ""} />
      </Field>
    </div>
  );
}

/**
 * State changes are operator-level on purpose: whoever finds a jammed machine
 * has to be able to stop prints landing on it without finding an admin.
 */
export function PrinterStateControl({
  printer,
  canRetire,
}: {
  printer: Printer;
  canRetire: boolean;
}) {
  const [state, action] = useActionState(setPrinterState, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={printer.id} />
      <div className="flex items-center gap-2">
        <Select name="state" defaultValue={printer.state} className="text-sm">
          <option value="available">available</option>
          <option value="maintenance">maintenance</option>
          {canRetire ? <option value="retired">retired</option> : null}
        </Select>
        <SubmitButton variant="secondary">Set</SubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
