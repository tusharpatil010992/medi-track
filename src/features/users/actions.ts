"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_STAFF_ROLES, type ClinicStaffRole } from "@/types/user";

export interface CreateUserState {
  error: string | null;
  provisioned: { fullName: string; email: string; temporaryPassword: string } | null;
}

function generateTemporaryPassword(): string {
  return `${randomBytes(12).toString("base64url")}aA1!`;
}

function isClinicStaffRole(value: string): value is ClinicStaffRole {
  return (CLINIC_STAFF_ROLES as readonly string[]).includes(value);
}

/**
 * Creates a clinic staff account.
 *
 * clinic_id comes from the acting ADMIN's own profile, never from the form, so
 * an ADMIN cannot create a user inside another clinic. The role is checked
 * against CLINIC_STAFF_ROLES so ADMIN and SUPER_ADMIN cannot be self-granted.
 */
export async function createClinicUser(
  _prevState: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const actingProfile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(actingProfile);

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const specialty = String(formData.get("specialty") ?? "").trim() || null;
  const licenseNumber = String(formData.get("licenseNumber") ?? "").trim() || null;

  if (!fullName) return { error: "Full name is required.", provisioned: null };
  if (!email.includes("@")) return { error: "A valid email is required.", provisioned: null };
  if (!isClinicStaffRole(role)) {
    return { error: "Select a valid role.", provisioned: null };
  }

  const admin = createAdminClient();

  const temporaryPassword = generateTemporaryPassword();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    return { error: `Could not create user: ${authError?.message}`, provisioned: null };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    clinic_id: clinicId,
    email,
    full_name: fullName,
    phone,
    role,
    specialty,
    license_number: licenseNumber,
    created_by: actingProfile.id,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { error: `Could not create profile: ${profileError.message}`, provisioned: null };
  }

  revalidatePath("/users");

  return { error: null, provisioned: { fullName, email, temporaryPassword } };
}

export interface ResetPasswordState {
  error: string | null;
  reset: { fullName: string; temporaryPassword: string } | null;
}

/**
 * Issues a new temporary password for a user in the acting ADMIN's clinic.
 *
 * Exists because there is no self-service recovery yet — accounts are created
 * with a one-time password and email is not wired until Phase 4, so a forgotten
 * password would otherwise mean editing the user in the Supabase dashboard.
 *
 * Two refusals matter:
 *  - An ADMIN cannot reset their own password here. /profile requires the
 *    current password; allowing self-reset through this path would let a
 *    hijacked session bypass that check entirely.
 *  - An ADMIN cannot reset another ADMIN. Peers should not be able to seize
 *    each other's accounts.
 */
export async function resetUserPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const actingProfile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(actingProfile);

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "Missing user reference.", reset: null };

  if (userId === actingProfile.id) {
    return {
      error: "Change your own password from My profile, where the current one is required.",
      reset: null,
    };
  }

  const supabase = await createClient();

  // Filtered by clinic_id, so a guessed id from another clinic finds nothing.
  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .eq("clinic_id", clinicId)
    .maybeSingle<{ id: string; full_name: string; role: string }>();

  if (!target) return { error: "User not found in this clinic.", reset: null };
  if (target.role === "ADMIN") {
    return { error: "An administrator cannot reset another administrator's password.", reset: null };
  }

  const temporaryPassword = generateTemporaryPassword();

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
  });

  if (error) return { error: `Could not reset password: ${error.message}`, reset: null };

  await supabase
    .from("profiles")
    .update({ updated_at: new Date().toISOString(), updated_by: actingProfile.id })
    .eq("id", userId)
    .eq("clinic_id", clinicId);

  revalidatePath("/users");

  return { error: null, reset: { fullName: target.full_name, temporaryPassword } };
}

/**
 * Activates or deactivates a clinic user.
 *
 * Scoped by clinic_id from the acting ADMIN's profile, so the update cannot
 * reach a user in another clinic even if the id is guessed.
 */
export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const actingProfile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(actingProfile);

  if (userId === actingProfile.id) {
    throw new Error("You cannot change your own account status");
  }

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
      updated_by: actingProfile.id,
    })
    .eq("id", userId)
    .eq("clinic_id", clinicId);

  revalidatePath("/users");
}
