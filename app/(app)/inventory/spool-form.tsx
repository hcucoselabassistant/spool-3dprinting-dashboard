"use client";

import { useActionState, useState } from "react";

import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import type { Spool } from "@/lib/queries/spools";

import {
  createSpool,
  setSpoolRetired,
  updateSpool,
  type ActionState,
} from "./actions";

const INITIAL: ActionState = { error: null };

export function AddSpoolForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createSpool, INITIAL);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-status-printing px-4 py-2 text-sm font-medium text-background"
      >
        Add spool
      </button>
    );
  }

  return (
    <form
      action={action}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <h2 className="mb-4 font-medium">Add spool</h2>
      <SpoolFields />
      <FormError message={state.error} />
      <div className="mt-4 flex gap-2">
        <SubmitButton>Add spool</SubmitButton>
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

export function EditSpoolForm({
  spool,
  onDone,
}: {
  spool: Spool;
  onDone: () => void;
}) {
  const [state, action] = useActionState(updateSpool, INITIAL);

  return (
    <form action={action} className="mt-3 border-t border-border pt-3">
      <input type="hidden" name="id" value={spool.id} />
      <SpoolFields spool={spool} />
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

function SpoolFields({ spool }: { spool?: Spool }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Material" hint="PLA, PETG, ABS, TPU">
        <TextInput name="material" defaultValue={spool?.material} required />
      </Field>
      <Field label="Colour">
        <TextInput name="color_name" defaultValue={spool?.color_name} required />
      </Field>
      <Field label="Brand">
        <TextInput name="brand" defaultValue={spool?.brand ?? ""} />
      </Field>
      <Field label="Colour swatch" hint="Optional hex, e.g. #1a1a1a">
        <TextInput
          name="color_hex"
          defaultValue={spool?.color_hex ?? ""}
          placeholder="#000000"
        />
      </Field>
      <Field label="Total grams">
        <TextInput
          name="total_grams"
          type="number"
          min={1}
          defaultValue={spool?.total_grams ?? 1000}
          required
        />
      </Field>
      <Field
        label="Remaining grams"
        hint={spool ? undefined : "Leave blank for a full spool"}
      >
        <TextInput
          name="remaining_grams"
          type="number"
          min={0}
          defaultValue={spool?.remaining_grams}
        />
      </Field>
      <Field label="Cost" hint="What the spool cost, in dollars">
        <TextInput
          name="cost_dollars"
          type="number"
          step="0.01"
          min="0"
          defaultValue={spool ? (spool.cost_cents / 100).toFixed(2) : ""}
        />
      </Field>
      {spool ? null : (
        <Field label="Opened on" hint="Optional">
          <TextInput name="opened_on" type="date" />
        </Field>
      )}
    </div>
  );
}

export function RetireSpoolButton({ spool }: { spool: Spool }) {
  const [state, action] = useActionState(setSpoolRetired, INITIAL);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={spool.id} />
      <input
        type="hidden"
        name="retired"
        value={spool.retired ? "false" : "true"}
      />
      <SubmitButton variant={spool.retired ? "secondary" : "danger"}>
        {spool.retired ? "Un-retire" : "Retire"}
      </SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
