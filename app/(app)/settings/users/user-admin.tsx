"use client";

import { useActionState } from "react";

import { Field, FormError, Select, SubmitButton, TextInput } from "@/components/form";
import type { StaffRow } from "@/lib/queries/staff";

import {
  createStaff,
  setStaffActive,
  setStaffRole,
  type ActionState,
} from "./actions";

const INITIAL: ActionState = { error: null };

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  operator: "Operator",
  ta: "TA",
};

export function CreateStaffForm() {
  const [state, action] = useActionState(createStaff, INITIAL);

  return (
    <form
      key={state.ok ? "created" : "new"}
      action={action}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <h2 className="mb-4 font-medium">Add a staff account</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <TextInput name="full_name" required />
        </Field>
        <Field label="Email">
          <TextInput name="email" type="email" required autoComplete="off" />
        </Field>
        <Field label="Temporary password" hint="At least 8 characters. Hand it to them.">
          <TextInput name="password" type="text" minLength={8} required autoComplete="off" />
        </Field>
        <Field label="Role">
          <Select name="role" defaultValue="ta">
            <option value="ta">TA</option>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <SubmitButton>Create account</SubmitButton>
        {state.ok ? (
          <span className="text-sm text-status-ready">Account created.</span>
        ) : null}
        <FormError message={state.error} />
      </div>
    </form>
  );
}

export function StaffRowControls({
  user,
  isSelf,
}: {
  user: StaffRow;
  isSelf: boolean;
}) {
  const [roleState, roleAction] = useActionState(setStaffRole, INITIAL);
  const [activeState, activeAction] = useActionState(setStaffActive, INITIAL);

  if (isSelf) {
    return (
      <span className="text-sm text-muted">
        {ROLE_LABEL[user.role]} · you
      </span>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {roleState.error ? (
        <span className="text-xs text-status-failed">{roleState.error}</span>
      ) : null}
      {activeState.error ? (
        <span className="text-xs text-status-failed">{activeState.error}</span>
      ) : null}

      <form action={roleAction} className="flex items-center gap-1">
        <input type="hidden" name="user_id" value={user.id} />
        <Select
          name="role"
          defaultValue={user.role}
          className="text-sm"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          <option value="ta">TA</option>
          <option value="operator">Operator</option>
          <option value="admin">Admin</option>
        </Select>
      </form>

      <form action={activeAction}>
        <input type="hidden" name="user_id" value={user.id} />
        <input type="hidden" name="active" value={user.active ? "false" : "true"} />
        <button
          type="submit"
          className={`rounded-md border px-3 py-1.5 text-sm ${
            user.active
              ? "border-border text-muted hover:text-status-failed"
              : "border-status-ready/40 text-status-ready"
          }`}
        >
          {user.active ? "Deactivate" : "Reactivate"}
        </button>
      </form>
    </div>
  );
}
