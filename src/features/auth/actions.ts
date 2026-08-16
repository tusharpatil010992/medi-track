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

  const [{ data: profile }, { data: clinicActive }] = await Promise.all([
    supabase.from("profiles").select("is_active").eq("id", data.user.id).single<{ is_active: boolean }>(),
    supabase.rpc("current_user_clinic_is_active"),
  ]);

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "This account is inactive. Contact your clinic administrator." };
  }

  // A suspended clinic locks out every one of its users, its own ADMIN
  // included. Distinguished from an inactive account so the person on the phone
  // is told something true — nothing they can fix themselves.
  if (clinicActive === false) {
    await supabase.auth.signOut();
    return { error: "This clinic is currently suspended. Contact your platform administrator." };
  }

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
