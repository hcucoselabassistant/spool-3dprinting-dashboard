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

  // createAdminClient throws if the service key is missing. Catch it so the
  // screen shows a clear message instead of crashing the whole page.
  let service: ReturnType<typeof createAdminClient>;
  try {
    service = createAdminClient();
  } catch {
    return {
      error:
        "Account creation is not configured: SUPABASE_SERVICE_ROLE_KEY is not " +
        "set on the server. Add it in Vercel (as a server variable) and redeploy.",
    };
  }

  const { data: created, error } = await service.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    // must_change_password forces the person to set their own password on first
    // login -- the admin-set one is temporary. Cleared when they change it.
    user_metadata: { full_name: fullName.trim(), must_change_password: true },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already been registered")) {
      return { error: "An account with that email already exists." };
    }
    if (msg.includes("api key") || msg.includes("invalid") || error.status === 401) {
      return {
        error:
          "The server's SUPABASE_SERVICE_ROLE_KEY is wrong. Copy the service_role " +
          "secret from Supabase → Settings → API into Vercel (exactly, no spaces) " +
          "and redeploy.",
      };
    }
    return { error: error.message };
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
