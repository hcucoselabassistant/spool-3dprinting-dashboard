import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type StaffRow = Database["public"]["Tables"]["app_user"]["Row"];

/** Every staff account. Admin-only in practice -- RLS lets admins read all. */
export async function getStaff(): Promise<StaffRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_user")
    .select("*")
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}
