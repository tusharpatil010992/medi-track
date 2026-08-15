import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/user";

/**
 * Resolves the authenticated user's trusted profile.
 *
 * This is the single source of tenant context. Role and clinic_id are always
 * read from the database here — never from a request body, query string, form
 * field or cookie supplied by the browser.
 *
 * Returns null when signed out, when no profile row exists, or when the
 * account has been deactivated.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  // getUser() revalidates the JWT with Supabase. getSession() only reads the
  // cookie, which a client could tamper with, so it must not be used here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !profile.is_active) return null;

  return profile;
}

/** Profile or redirect to /login. Use at the top of every protected page. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Profile or redirect to /dashboard when the role is not permitted. */
export async function requireRole(allowed: readonly UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!allowed.includes(profile.role)) redirect("/dashboard");
  return profile;
}

/**
 * The acting user's clinic_id, guaranteed non-null.
 *
 * SUPER_ADMIN has no clinic and must not reach clinic-scoped writes, so this
 * throws rather than silently returning null.
 */
export function requireClinicId(profile: Profile): string {
  if (!profile.clinic_id) {
    throw new Error(`${profile.role} has no clinic context for this operation`);
  }
  return profile.clinic_id;
}
