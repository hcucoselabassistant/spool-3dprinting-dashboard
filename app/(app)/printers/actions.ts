"use server";

import { revalidatePath } from "next/cache";

import { canOperate, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type PrinterState = Database["public"]["Enums"]["printer_state"];

export type ActionState = { error: string | null; ok?: boolean };

/**
 * RLS is the actual boundary -- the printer_operate_all policy decides what goes
 * through. This check exists so a TA gets a sentence instead of a silent no-op,
 * since an UPDATE filtered by RLS affects zero rows without raising. Printers
 * and inventory are operator/admin territory; TAs have no access.
 */
async function requireOperate(): Promise<string | null> {
  const staff = await requireStaff();
  return canOperate(staff) ? null : "You do not have access to the printer fleet.";
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
  const denied = await requireOperate();
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
  const denied = await requireOperate();
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
 * Flag a printer down or return it to service. Operator/admin only -- a TA has
 * no access to the fleet. Whoever finds a jammed machine can stop prints landing
 * on it without hunting for an admin.
 */
export async function setPrinterState(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireOperate();
  if (denied) return { error: denied };

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

/**
 * Log a service event, then return the printer to service. This is the prompt
 * that fires when an operator brings a machine back from maintenance -- the
 * service record is what resets hours_since_service, since that view counts
 * attempts after the last logged service.
 *
 * Operator/admin only, like the rest of the fleet. The whole point is the
 * person at the machine records what they did.
 */
export async function logMaintenance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireOperate();
  if (denied) return { error: denied };
  const staff = await requireStaff();

  const printerId = formData.get("printer_id");
  const action = formData.get("action");
  const hoursRaw = formData.get("hours_at_service");
  const notes = asOptionalText(formData.get("notes"));

  if (typeof printerId !== "string") return { error: "Missing printer id." };
  if (typeof action !== "string" || action.trim() === "") {
    return { error: "Describe what was done — this is the service record." };
  }

  const hours =
    typeof hoursRaw === "string" && hoursRaw.trim() !== ""
      ? Number(hoursRaw)
      : null;
  if (hours !== null && (!Number.isFinite(hours) || hours < 0)) {
    return { error: "Hours at service must be a positive number, or blank." };
  }

  const supabase = await createClient();

  const { error: logError } = await supabase.from("maintenance_log").insert({
    printer_id: printerId,
    performed_by: staff.id,
    action: action.trim(),
    hours_at_service: hours,
    notes,
  });

  if (logError) return { error: logError.message };

  // Return to service only from maintenance -- never resurrect a retired
  // machine as a side effect of logging service on it.
  const { data: printer } = await supabase
    .from("printer")
    .select("state")
    .eq("id", printerId)
    .single();

  if (printer?.state === "maintenance") {
    const { error: stateError } = await supabase
      .from("printer")
      .update({ state: "available" })
      .eq("id", printerId);
    if (stateError) return { error: stateError.message };
  }

  revalidatePath("/printers");
  revalidatePath("/");
  return { error: null, ok: true };
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
