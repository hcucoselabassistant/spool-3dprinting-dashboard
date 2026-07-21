"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type PrinterState = Database["public"]["Enums"]["printer_state"];

export type ActionState = { error: string | null };

/**
 * RLS is the actual boundary -- admin_all_printer and op_update_printer decide
 * what goes through. These checks exist so the operator gets a sentence instead
 * of a silent no-op, since an UPDATE filtered by RLS affects zero rows without
 * raising.
 */
async function requireAdmin(): Promise<string | null> {
  const staff = await requireStaff();
  return staff.role === "admin"
    ? null
    : "Only administrators can change the printer fleet.";
}

function readInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createPrinter(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const name = formData.get("name");
  const model = formData.get("model");
  const serviceInterval = readInt(formData.get("service_interval_hours"));
  const nozzle = formData.get("nozzle_mm");

  if (typeof name !== "string" || name.trim() === "") {
    return { error: "Name is required — this is the label on the machine." };
  }
  if (typeof model !== "string" || model.trim() === "") {
    return { error: "Model is required." };
  }
  if (serviceInterval === null || serviceInterval <= 0) {
    return { error: "Service interval must be a positive number of hours." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("printer").insert({
    name: name.trim(),
    model: model.trim(),
    service_interval_hours: serviceInterval,
    nozzle_mm: typeof nozzle === "string" && nozzle ? Number(nozzle) : 0.4,
    build_volume: asOptionalText(formData.get("build_volume")),
    notes: asOptionalText(formData.get("notes")),
  });

  if (error) {
    // 23505 is a unique violation on printer.name.
    return {
      error:
        error.code === "23505"
          ? `A printer named "${name.trim()}" already exists.`
          : error.message,
    };
  }

  revalidatePath("/printers");
  return { error: null };
}

export async function updatePrinter(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Missing printer id." };

  const name = formData.get("name");
  const model = formData.get("model");
  const serviceInterval = readInt(formData.get("service_interval_hours"));

  if (typeof name !== "string" || name.trim() === "") {
    return { error: "Name is required." };
  }
  if (typeof model !== "string" || model.trim() === "") {
    return { error: "Model is required." };
  }
  if (serviceInterval === null || serviceInterval <= 0) {
    return { error: "Service interval must be a positive number of hours." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("printer")
    .update({
      name: name.trim(),
      model: model.trim(),
      service_interval_hours: serviceInterval,
      build_volume: asOptionalText(formData.get("build_volume")),
      notes: asOptionalText(formData.get("notes")),
    })
    .eq("id", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? `A printer named "${name.trim()}" already exists.`
          : error.message,
    };
  }

  revalidatePath("/printers");
  return { error: null };
}

/**
 * Flagging a printer down is an operator action, not an admin one -- the person
 * who finds a broken machine at 11pm has to be able to stop prints landing on
 * it. Phase 6 adds the maintenance log prompt on the way back to available.
 */
export async function setPrinterState(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const id = formData.get("id");
  const state = formData.get("state");

  if (typeof id !== "string") return { error: "Missing printer id." };
  if (!isPrinterState(state)) return { error: "Unknown printer state." };

  // 'printing' is a consequence of an attempt existing, never a manual choice.
  // Setting it by hand would desynchronise the machine from its live attempt.
  if (state === "printing") {
    return {
      error:
        "A printer becomes 'printing' by starting a print, not by being set.",
    };
  }

  if (state === "retired") {
    const denied = await requireAdmin();
    if (denied) return { error: "Only administrators can retire a printer." };
  }

  const supabase = await createClient();

  // Refuse to take a machine down mid-print. The attempt would be orphaned:
  // still live, on a printer the fleet now considers unavailable.
  if (state === "maintenance" || state === "retired") {
    const { data: live, error: liveError } = await supabase
      .from("attempt")
      .select("id")
      .eq("printer_id", id)
      .is("ended_at", null)
      .maybeSingle();

    if (liveError) return { error: liveError.message };
    if (live) {
      return {
        error:
          "This printer has a print running. Finish or cancel it from the floor first.",
      };
    }
  }

  const { error } = await supabase
    .from("printer")
    .update({ state })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/printers");
  return { error: null };
}

function isPrinterState(value: FormDataEntryValue | null): value is PrinterState {
  return (
    value === "available" ||
    value === "printing" ||
    value === "maintenance" ||
    value === "retired"
  );
}

function asOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
