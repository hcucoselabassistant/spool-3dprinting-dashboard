"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

/**
 * Change the signed-in user's own password. Runs on their own session -- no
 * service key, no admin rights. The same call clears the must_change_password
 * metadata flag, so a forced first-login change lets them back into the app.
 */
export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const password = formData.get("password");
  const confirm = formData.get("confirm");

  if (typeof password !== "string" || password.length < 8) {
    return { error: "Use at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "The two passwords don't match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password,
    data: { must_change_password: false },
  });

  if (error) {
    // Supabase rejects reusing the current password, among others.
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
