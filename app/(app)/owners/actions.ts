"use server";

import { revalidatePath } from "next/cache";

import { canOperate, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type OwnerKind = Database["public"]["Enums"]["owner_kind"];

export type ActionState = { error: string | null };

function isOwnerKind(value: FormDataEntryValue | null): value is OwnerKind {
  return (
    value === "student" ||
    value === "course" ||
    value === "faculty" ||
    value === "department"
  );
}

function asOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function readQuota(value: FormDataEntryValue | null): number | null | "invalid" {
  // Blank means unlimited, which is null in the database -- not zero.
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return "invalid";
  return parsed;
}

/**
 * Creating an owner happens mid-conversation at the desk and must take seconds,
 * so only a name is required. Everything else can be filled in later.
 *
 * Owners are not users. Nobody is being invited, nothing is emailed.
 */
export async function createOwner(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const displayName = formData.get("display_name");
  const kind = formData.get("kind");
  const quota = readQuota(formData.get("quota_grams"));

  if (typeof displayName !== "string" || displayName.trim() === "") {
    return { error: "A name is required." };
  }
  if (!isOwnerKind(kind)) {
    return { error: "Pick what kind of owner this is." };
  }
  if (quota === "invalid") {
    return { error: "Quota must be a whole number of grams, or blank." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("owner").insert({
    display_name: displayName.trim(),
    kind,
    email: asOptionalText(formData.get("email")),
    course_code: asOptionalText(formData.get("course_code")),
    quota_grams: quota,
  });

  if (error) return { error: error.message };

  revalidatePath("/owners");
  revalidatePath("/jobs");
  return { error: null };
}

export async function updateOwner(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  // A TA can create an owner but not edit an existing one -- editing is
  // operator/admin, matching the RLS.
  if (!canOperate(staff)) {
    return { error: "You do not have permission to edit owners." };
  }

  const id = formData.get("id");
  const displayName = formData.get("display_name");
  const kind = formData.get("kind");
  const quota = readQuota(formData.get("quota_grams"));

  if (typeof id !== "string") return { error: "Missing owner id." };
  if (typeof displayName !== "string" || displayName.trim() === "") {
    return { error: "A name is required." };
  }
  if (!isOwnerKind(kind)) return { error: "Pick what kind of owner this is." };
  if (quota === "invalid") {
    return { error: "Quota must be a whole number of grams, or blank." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("owner")
    .update({
      display_name: displayName.trim(),
      kind,
      email: asOptionalText(formData.get("email")),
      course_code: asOptionalText(formData.get("course_code")),
      quota_grams: quota,
      active: formData.get("active") !== "false",
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/owners");
  return { error: null };
}
