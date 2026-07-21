"use client";

import { useActionState, useState } from "react";

import { Field, FormError, SubmitButton, TextInput } from "@/components/form";

import { createJob, type ActionState } from "./actions";
import { OwnerPicker, type OwnerOption } from "./owner-picker";

const INITIAL: ActionState = { error: null };

const MATERIALS = ["PLA", "PETG", "ABS", "TPU"];

export function NewJobForm({ owners }: { owners: OwnerOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createJob, INITIAL);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-status-printing px-4 py-2 text-sm font-medium text-background"
      >
        New job
      </button>
    );
  }

  return (
    // Keyed on the last submitted job, so a success remounts a blank form
    // without an effect reaching in to reset it.
    <form
      key={state.submittedId ?? "new"}
      action={action}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <h2 className="mb-4 font-medium">New job</h2>

      <div className="mb-3">
        <span className="mb-1.5 block text-sm text-muted">Owner</span>
        <OwnerPicker owners={owners} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" hint="What this is, so it can be found on the shelf">
          <TextInput name="title" required />
        </Field>
        <Field label="Material">
          <TextInput
            name="material"
            list="materials"
            defaultValue="PLA"
            required
          />
          <datalist id="materials">
            {MATERIALS.map((material) => (
              <option key={material} value={material} />
            ))}
          </datalist>
        </Field>

        <Field label="Estimated minutes" hint="From the slicer">
          <TextInput name="est_minutes" type="number" min={1} required />
        </Field>
        <Field label="Estimated grams" hint="From the slicer">
          <TextInput name="est_grams" type="number" min={1} required />
        </Field>

        <Field label="Colour preference" hint="Optional">
          <TextInput name="color_preference" />
        </Field>
        <Field label="Needed by" hint="Optional">
          <TextInput name="needed_by" type="date" />
        </Field>

        <Field label="Priority" hint="Higher sorts first in the queue">
          <TextInput name="priority" type="number" defaultValue={0} />
        </Field>
        <Field label="File" hint="Optional .gcode / .3mf / .stl, up to 200 MB">
          <TextInput name="file" type="file" accept=".gcode,.3mf,.stl,.obj" />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Notes" hint="Optional">
          <TextInput name="notes" />
        </Field>
      </div>

      <div className="mt-4">
        <FormError message={state.error} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <SubmitButton>Submit job</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Close
        </button>
        {state.submittedId ? (
          <span className="text-sm text-status-ready">Job submitted.</span>
        ) : null}
      </div>
    </form>
  );
}
