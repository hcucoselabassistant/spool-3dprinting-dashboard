"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type OwnerKind = Database["public"]["Enums"]["owner_kind"];

/**
 * submittedId is the id of the job just created. The form keys itself on it so
 * a success remounts a blank form -- the desk case is several jobs in a row.
 */
export type ActionState = {
  error: string | null;
  submittedId?: string;
  /** Set when the insert failed after a file was already uploaded, so the
   *  client can delete the orphan. */
  orphanedPath?: string;
};

function readInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function asOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function isOwnerKind(value: FormDataEntryValue | null): value is OwnerKind {
  return (
    value === "student" ||
    value === "course" ||
    value === "faculty" ||
    value === "department"
  );
}

/**
 * Submit a job.
 *
 * The owner is either an existing record or one created here in the same
 * submission -- a TA at the desk should not have to leave the form to add a
 * student who has never printed before.
 *
 * Estimates are the slicer's numbers and are required: the queue is scheduled
 * against them before anything starts printing, and guard_spool_sufficient
 * refuses an attempt whose spool cannot cover est_grams.
 *
 * The file is NOT in this payload. It is uploaded from the browser straight to
 * Storage before this runs, and only its path arrives here as file_path. Vercel
 * caps a Server Action body at 4.5 MB, so a .gcode routed through here would
 * fail in production; the browser talks to Storage directly instead.
 */
export async function createJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const supabase = await createClient();

  const title = formData.get("title");
  const material = formData.get("material");
  const estMinutes = readInt(formData.get("est_minutes"));
  const estGrams = readInt(formData.get("est_grams"));

  if (typeof title !== "string" || title.trim() === "") {
    return { error: "Give the job a title so it can be found on the shelf." };
  }
  if (typeof material !== "string" || material.trim() === "") {
    return { error: "Material is required." };
  }
  if (estMinutes === null || estMinutes <= 0) {
    return { error: "Estimated minutes must be a positive whole number." };
  }
  if (estGrams === null || estGrams <= 0) {
    return { error: "Estimated grams must be a positive whole number." };
  }

  const ownerId = await resolveOwner(formData, supabase);
  if ("error" in ownerId) return { error: ownerId.error };

  const filePath = asOptionalText(formData.get("file_path"));

  const { data, error } = await supabase
    .from("job")
    .insert({
      owner_id: ownerId.id,
      submitted_by: staff.id,
      title: title.trim(),
      material: material.trim(),
      color_preference: asOptionalText(formData.get("color_preference")),
      est_minutes: estMinutes,
      est_grams: estGrams,
      needed_by: asOptionalText(formData.get("needed_by")),
      notes: asOptionalText(formData.get("notes")),
      priority: readInt(formData.get("priority")) ?? 0,
      file_path: filePath,
      // status is left to its default of 'submitted'. Approval is a separate,
      // deliberate operator action -- see spec/02-workflows.md.
    })
    .select("id")
    .single();

  if (error) {
    // The upload already happened client-side; hand the path back so the
    // browser can remove the now-orphaned file.
    return { error: error.message, orphanedPath: filePath ?? undefined };
  }

  revalidatePath("/jobs");
  revalidatePath("/owners");
  return { error: null, submittedId: data.id };
}

type ResolvedOwner = { id: string } | { error: string };

async function resolveOwner(
  formData: FormData,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ResolvedOwner> {
  const existing = formData.get("owner_id");
  if (typeof existing === "string" && existing !== "") {
    return { id: existing };
  }

  const newName = formData.get("new_owner_name");
  if (typeof newName !== "string" || newName.trim() === "") {
    return { error: "Pick an owner, or type a name to create one." };
  }

  const kind = formData.get("new_owner_kind");
  const { data, error } = await supabase
    .from("owner")
    .insert({
      display_name: newName.trim(),
      kind: isOwnerKind(kind) ? kind : "student",
      email: asOptionalText(formData.get("new_owner_email")),
      course_code: asOptionalText(formData.get("new_owner_course")),
    })
    .select("id")
    .single();

  if (error) return { error: `Could not create owner: ${error.message}` };
  return { id: data.id };
}
