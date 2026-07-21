"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

export type ActionState = { error: string | null; ok?: boolean };

/** Every mutation here is admin-only; the acting user is checked first. */
async function requireAdminId(): Promise<
  { id: string } | { error: string }
> {
  const staff = await requireStaff();
  if (staff.role !== "admin") {
    return { error: "Only administrators can manage accounts." };
  }
  return { id: staff.id };
}

function isRole(value: FormDataEntryValue | null): value is UserRole {
  return value === "admin" || value === "operator" || value === "ta";
}

/**
 * Create a staff account. Creating an auth user needs elevated rights, so this
 * uses the service-role client -- only after confirming the caller is an admin.
 * The account is created already confirmed; the admin hands over the password.
 *
 * The provisioning trigger inserts the app_user row (as 'ta') the moment the
 * auth user appears, reading the full name from user metadata. If a higher role
 * was chosen, it is applied straight after.
 */
export async function createStaff(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdminId();
  if ("error" in admin) return { error: admin.error };

  const email = formData.get("email");
  const fullName = formData.get("full_name");
  const password = formData.get("password");
  const role = formData.get("role");

  if (typeof email !== "string" || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }
  if (typeof fullName !== "string" || fullName.trim() === "") {
    return { error: "Enter the person's name." };
  }
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Set a temporary password of at least 8 characters." };
  }
  if (!isRole(role)) {
    return { error: "Pick a role." };
  }

  const service = createAdminClient();

  const { data: created, error } = await service.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim() },
  });

  if (error) {
    return {
      error: error.message.includes("already been registered")
        ? "An account with that email already exists."
        : error.message,
    };
  }

  // The trigger created the app_user row as 'ta'. Bump it if needed.
  if (role !== "ta" && created.user) {
    const { error: roleError } = await service
      .from("app_user")
      .update({ role })
      .eq("id", created.user.id);
    if (roleError) {
      return {
        error: `Account created, but setting the role failed: ${roleError.message}`,
      };
    }
  }

  revalidatePath("/settings/users");
  return { error: null, ok: true };
}

export async function setStaffRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdminId();
  if ("error" in admin) return { error: admin.error };

  const userId = formData.get("user_id");
  const role = formData.get("role");

  if (typeof userId !== "string") return { error: "Missing user id." };
  if (!isRole(role)) return { error: "Unknown role." };

  // Don't let an admin change their own role -- the easiest way to lock the last
  // admin out of the org. Another admin must do it.
  if (userId === admin.id) {
    return { error: "Change your own role from another admin account." };
  }

  // RLS also allows this, but the service client keeps it uniform with create.
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_user")
    .update({ role })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/settings/users");
  return { error: null, ok: true };
}

export async function setStaffActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdminId();
  if ("error" in admin) return { error: admin.error };

  const userId = formData.get("user_id");
  const active = formData.get("active") === "true";

  if (typeof userId !== "string") return { error: "Missing user id." };
  if (userId === admin.id) {
    return { error: "You can't deactivate your own account." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_user")
    .update({ active })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/settings/users");
  return { error: null, ok: true };
}
