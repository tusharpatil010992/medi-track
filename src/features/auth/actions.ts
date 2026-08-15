"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface AuthFormState {
  error: string | null;
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Deliberately generic: distinguishing "no such user" from "wrong password"
    // lets an attacker enumerate valid accounts.
    return { error: "Invalid email or password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .single<{ is_active: boolean }>();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "This account is inactive. Contact your clinic administrator." };
  }

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
