"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DUMMY_CONFIG_VALUES } from "@/types/clinic";

export interface CreateClinicState {
  error: string | null;
  /** Present on success. Shown once so the SUPER_ADMIN can hand over credentials. */
  provisioned: { clinicName: string; adminEmail: string; temporaryPassword: string } | null;
}

function generateTemporaryPassword(): string {
  return `${randomBytes(12).toString("base64url")}aA1!`;
}

/**
 * Creates a clinic and provisions its first ADMIN.
 *
 * Spans two systems (auth.users + public tables) that cannot share one
 * transaction, so failures compensate by deleting what was already created.
 * Deleting the clinic cascades to clinic_config.
 */
export async function createClinic(
  _prevState: CreateClinicState,
  formData: FormData,
): Promise<CreateClinicState> {
  await requireRole(["SUPER_ADMIN"]);

  const name = String(formData.get("name") ?? "").trim();
  const adminEmail = String(formData.get("adminEmail") ?? "").trim().toLowerCase();
  const adminFullName = String(formData.get("adminFullName") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "UTC").trim() || "UTC";
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!name) return { error: "Clinic name is required.", provisioned: null };
  if (!adminFullName) return { error: "Administrator name is required.", provisioned: null };
  if (!adminEmail.includes("@")) {
    return { error: "A valid administrator email is required.", provisioned: null };
  }

  const admin = createAdminClient();

  const { data: clinic, error: clinicError } = await admin
    .from("clinics")
    .insert({ name, email, phone, timezone })
    .select("id, name")
    .single<{ id: string; name: string }>();

  if (clinicError || !clinic) {
    return { error: `Could not create clinic: ${clinicError?.message}`, provisioned: null };
  }

  const { error: configError } = await admin
    .from("clinic_config")
    .insert({ clinic_id: clinic.id, timezone, ...DUMMY_CONFIG_VALUES });

  if (configError) {
    await admin.from("clinics").delete().eq("id", clinic.id);
    return { error: `Could not create clinic config: ${configError.message}`, provisioned: null };
  }

  const temporaryPassword = generateTemporaryPassword();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: temporaryPassword,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    await admin.from("clinics").delete().eq("id", clinic.id);
    return { error: `Could not create administrator: ${authError?.message}`, provisioned: null };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    clinic_id: clinic.id,
    email: adminEmail,
    full_name: adminFullName,
    role: "ADMIN",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    await admin.from("clinics").delete().eq("id", clinic.id);
    return { error: `Could not create administrator profile: ${profileError.message}`, provisioned: null };
  }

  revalidatePath("/clinics");

  return {
    error: null,
    provisioned: { clinicName: clinic.name, adminEmail, temporaryPassword },
  };
}

/** Activates or deactivates a clinic. Soft state change — clinics are never deleted. */
export async function setClinicActive(clinicId: string, isActive: boolean): Promise<void> {
  const profile = await requireRole(["SUPER_ADMIN"]);

  const supabase = await createClient();
  await supabase
    .from("clinics")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", clinicId);

  revalidatePath("/clinics");
}
