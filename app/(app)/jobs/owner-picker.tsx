"use client";

import { useMemo, useState } from "react";

import { Field, Select, TextInput } from "@/components/form";

export type OwnerOption = {
  id: string;
  display_name: string;
  kind: string;
  course_code: string | null;
};

/**
 * Type-ahead over existing owners, falling back to creating one inline.
 *
 * The whole list is sent down rather than round-tripping a search: there are a
 * few hundred owners at most, and a TA typing a name at the desk should not be
 * waiting on a request per keystroke.
 */
export function OwnerPicker({ owners }: { owners: OwnerOption[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OwnerOption | null>(null);
  const [creating, setCreating] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return [];
    return owners
      .filter(
        (owner) =>
          owner.display_name.toLowerCase().includes(q) ||
          (owner.course_code ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [owners, query]);

  if (creating) {
    return (
      <div className="rounded-md border border-border bg-surface-raised p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">New owner</span>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="text-sm text-muted hover:text-foreground"
          >
            Pick an existing owner instead
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <TextInput
              name="new_owner_name"
              defaultValue={query}
              autoFocus
              required
            />
          </Field>
          <Field label="Kind">
            <Select name="new_owner_kind" defaultValue="student">
              <option value="student">student</option>
              <option value="course">course</option>
              <option value="faculty">faculty</option>
              <option value="department">department</option>
            </Select>
          </Field>
          <Field label="Email" hint="Optional. Used for the pickup notice.">
            <TextInput name="new_owner_email" type="email" />
          </Field>
          <Field label="Course code" hint="Optional">
            <TextInput name="new_owner_course" />
          </Field>
        </div>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-surface-raised px-3 py-2.5">
        <input type="hidden" name="owner_id" value={selected.id} />
        <span>
          {selected.display_name}
          <span className="text-muted">
            {" · "}
            {selected.kind}
            {selected.course_code ? ` · ${selected.course_code}` : ""}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setQuery("");
          }}
          className="text-sm text-muted hover:text-foreground"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <TextInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search owners by name or course"
        aria-label="Owner"
        autoComplete="off"
        className="w-full"
      />

      {query.trim() !== "" ? (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          {matches.map((owner) => (
            <button
              key={owner.id}
              type="button"
              onClick={() => setSelected(owner)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-raised"
            >
              {owner.display_name}
              <span className="text-muted">
                {" · "}
                {owner.kind}
                {owner.course_code ? ` · ${owner.course_code}` : ""}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="block w-full border-t border-border px-3 py-2 text-left text-sm text-status-printing hover:bg-surface-raised"
          >
            {matches.length === 0
              ? `No match — create “${query.trim()}”`
              : `Create “${query.trim()}” as a new owner`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
