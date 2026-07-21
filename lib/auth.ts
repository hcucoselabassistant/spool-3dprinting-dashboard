import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Staff = Database["public"]["Tables"]["app_user"]["Row"];

/**
 * The authorization boundary. proxy.ts only does an optimistic cookie check to
 * keep prefetches cheap; this runs next to the data and is what actually
 * decides whether a request may proceed.
 *
 * Cached per request, so calling it in a layout and again in a page costs one
 * round trip.
 */
export const requireStaff = cache(async (): Promise<Staff> => {
  const supabase = await createClient();

  // getUser revalidates the JWT against Supabase Auth. Do not swap this for
  // getSession, which trusts the cookie without verifying it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: staff } = await supabase
    .from("app_user")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Authenticating is not the same as being staff. A user can exist in
  // auth.users without an app_user row -- they get nothing.
  if (!staff || !staff.active) {
    redirect("/login?error=not-staff");
  }

  return staff;
});

export async function isAdmin(): Promise<boolean> {
  const staff = await requireStaff();
  return staff.role === "admin";
}
