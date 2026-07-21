"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function signIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const next = formData.get("next");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Enter an email address and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // The client message stays vague on purpose -- it must not distinguish
    // "no such account" from "wrong password". The real reason goes to the
    // server log, where only staff running the app can see it.
    console.error("[auth] sign-in failed:", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return { error: "Those credentials were not accepted." };
  }

  revalidatePath("/", "layout");
  // Only accept a relative path. An absolute URL here would make the login form
  // an open redirect.
  const destination =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/";
  redirect(destination);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
