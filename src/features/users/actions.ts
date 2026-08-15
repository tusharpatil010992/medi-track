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
