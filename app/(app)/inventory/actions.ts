"use server";

import { revalidatePath } from "next/cache";

import { canOperate, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

// Inventory is operator/admin territory; a TA has no access. RLS enforces it --
// this just turns a silent zero-row write into a sentence.
async function requireOperate(): Promise<string | null> {
  const staff = await requireStaff();
  return canOperate(staff) ? null : "You do not have access to inventory.";
}

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

/**
 * Filament is stored in whole grams and money in whole cents. The form takes
 * dollars because that is what is printed on the invoice; the conversion to
 * cents happens here so no float reaches the database.
 */
function dollarsToCents(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return 0;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export async function createSpool(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireOperate();
  if (denied) return { error: denied };

  const material = formData.get("material");
  const colorName = formData.get("color_name");
  const totalGrams = readInt(formData.get("total_grams"));
  const remainingRaw = readInt(formData.get("remaining_grams"));
  const costCents = dollarsToCents(formData.get("cost_dollars"));

  if (typeof material !== "string" || material.trim() === "") {
    return { error: "Material is required." };
  }
  if (typeof colorName !== "string" || colorName.trim() === "") {
    return { error: "Colour is required." };
  }
  if (totalGrams === null || totalGrams <= 0) {
    return { error: "Total grams must be a positive whole number." };
  }
  if (costCents === null) {
    return { error: "Cost must be a positive amount." };
  }

  // A new spool is assumed full unless stated otherwise.
  const remaining = remainingRaw ?? totalGrams;
  if (remaining < 0 || remaining > totalGrams) {
    return { error: "Remaining grams must be between zero and the total." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("spool").insert({
    material: material.trim(),
    color_name: colorName.trim(),
    color_hex: asOptionalText(formData.get("color_hex")),
    brand: asOptionalText(formData.get("brand")),
    total_grams: totalGrams,
    remaining_grams: remaining,
    cost_cents: costCents,
    opened_on: asOptionalText(formData.get("opened_on")),
  });

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return { error: null };
}

export async function updateSpool(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireOperate();
  if (denied) return { error: denied };

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Missing spool id." };

  const totalGrams = readInt(formData.get("total_grams"));
  const remaining = readInt(formData.get("remaining_grams"));
  const costCents = dollarsToCents(formData.get("cost_dollars"));

  if (totalGrams === null || totalGrams <= 0) {
    return { error: "Total grams must be a positive whole number." };
  }
  if (remaining === null || remaining < 0 || remaining > totalGrams) {
    return { error: "Remaining grams must be between zero and the total." };
  }
  if (costCents === null) {
    return { error: "Cost must be a positive amount." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("spool")
    .update({
      material: asOptionalText(formData.get("material")) ?? undefined,
      color_name: asOptionalText(formData.get("color_name")) ?? undefined,
      color_hex: asOptionalText(formData.get("color_hex")),
      brand: asOptionalText(formData.get("brand")),
      total_grams: totalGrams,
      remaining_grams: remaining,
      cost_cents: costCents,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return { error: null };
}

/**
 * Retire, never delete. Historical attempts reference the spool, and the cost of
 * a past print is resolved against the spool it actually used -- deleting one
 * would silently rewrite what a finished job cost.
 */
export async function setSpoolRetired(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireOperate();
  if (denied) return { error: denied };

  const id = formData.get("id");
  const retired = formData.get("retired") === "true";

  if (typeof id !== "string") return { error: "Missing spool id." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("spool")
    .update({ retired })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return { error: null };
}
