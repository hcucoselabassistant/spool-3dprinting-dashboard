"use client";

import { useActionState, useState } from "react";

import { Field, FormError, Select, SubmitButton, TextInput } from "@/components/form";
import { formatCents, formatGrams } from "@/lib/format";
import type { OwnerWithUsage } from "@/lib/queries/owners";

import { createOwner, updateOwner, type ActionState } from "./actions";

const INITIAL: ActionState = { error: null };

const KINDS = ["student", "course", "faculty", "department"] as const;

/**
 * A single inline row, not a modal -- spec/03-screens.md. This happens while a
 * student is standing at the desk, so it has to be typeable without breaking
 * the conversation.
 */
export function InlineCreateOwner() {
  const [state, action] = useActionState(createOwner, INITIAL);

  return (
    <form
      action={action}
      className="rounded-lg border border-border bg-surface p-3"
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <TextInput
            name="display_name"
            placeholder="Name"
            aria-label="Name"
            required
            className="w-full"
          />
        </div>
        <Select name="kind" defaultValue="student" aria-label="Kind">
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </Select>
        <TextInput
          name="course_code"
          placeholder="Course"
          aria-label="Course code"
          className="w-32"
        />
        <TextInput
          name="email"
          type="email"
          placeholder="Email"
          aria-label="Email"
          className="w-52"
        />
        <TextInput
          name="quota_grams"
          type="number"
          min={0}
          placeholder="Quota (g)"
          aria-label="Quota in grams"
          className="w-32"
        />
        <SubmitButton>Add owner</SubmitButton>
      </div>
      <div className="mt-2">
        <FormError message={state.error} />
      </div>
    </form>
  );
}

export function OwnerRow({
  owner,
  canEdit,
}: {
  owner: OwnerWithUsage;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const overQuota =
    owner.quota_grams !== null && owner.gramsSuccess > owner.quota_grams;

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="grid grid-cols-12 items-center gap-3 px-3 py-3 text-sm">
        <div className="col-span-3">
          <p className="font-medium">{owner.display_name}</p>
          <p className="text-muted">
            {owner.kind}
            {owner.course_code ? ` · ${owner.course_code}` : ""}
            {owner.active ? "" : " · inactive"}
          </p>
        </div>

        <div className="col-span-3">
          <span className={overQuota ? "text-status-failed" : ""}>
            {formatGrams(owner.gramsSuccess)}
          </span>
          <span className="text-muted">
            {owner.quota_grams === null
              ? " · no quota"
              : ` / ${formatGrams(owner.quota_grams)}`}
          </span>
          {owner.gramsFailed > 0 ? (
            <p className="text-muted">
              {formatGrams(owner.gramsFailed)} on failures
            </p>
          ) : null}
        </div>

        <div className="col-span-2">{formatCents(owner.costCents)}</div>

        <div className="col-span-2 text-muted">
          {owner.activeJobs === 0 ? "—" : `${owner.activeJobs} active`}
        </div>

        <div className="col-span-2 text-right">
          {canEdit ? (
            <button
              onClick={() => setEditing((v) => !v)}
              className="rounded-md border border-border px-3 py-1.5 text-muted hover:text-foreground"
            >
              {editing ? "Close" : "Edit"}
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <EditOwnerForm owner={owner} onDone={() => setEditing(false)} />
      ) : null}
    </div>
  );
}

function EditOwnerForm({
  owner,
  onDone,
}: {
  owner: OwnerWithUsage;
  onDone: () => void;
}) {
  const [state, action] = useActionState(updateOwner, INITIAL);

  return (
    <form action={action} className="bg-surface px-3 pb-4">
      <input type="hidden" name="id" value={owner.id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name">
          <TextInput name="display_name" defaultValue={owner.display_name} required />
        </Field>
        <Field label="Kind">
          <Select name="kind" defaultValue={owner.kind}>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Course code">
          <TextInput name="course_code" defaultValue={owner.course_code ?? ""} />
        </Field>
        <Field label="Email" hint="Used for the pickup notice">
          <TextInput name="email" type="email" defaultValue={owner.email ?? ""} />
        </Field>
        <Field label="Quota (grams)" hint="Blank means unlimited">
          <TextInput
            name="quota_grams"
            type="number"
            min={0}
            defaultValue={owner.quota_grams ?? ""}
          />
        </Field>
        <Field label="Active">
          <Select name="active" defaultValue={String(owner.active)}>
            <option value="true">active</option>
            <option value="false">inactive</option>
          </Select>
        </Field>
      </div>
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
