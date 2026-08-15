"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isConsultationEditable, type Consultation } from "@/types/clinical";
import { recordsOpticalPower } from "@/types/user";

export interface OpticalPowerFormState {
  error: string | null;
  success: boolean;
}

/** Parses a dioptre value. Returns undefined for blank, or a message when invalid. */
function readDioptre(formData: FormData, key: string): number | null | string {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) return `${key.replaceAll("_", " ")} must be a number.`;
  if (value < -30 || value > 30) return `${key.replaceAll("_", " ")} is outside the plausible range.`;

  return value;
}

function readAxis(formData: FormData, key: string): number | null | string {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;

  const value = Number(raw);
  if (!Number.isInteger(value)) return "Axis must be a whole number.";
  if (value < 0 || value > 180) return "Axis must be between 0 and 180 degrees.";

  return value;
}

/**
 * Records or updates the optical power for a consultation.
 *
 * Open to DOCTOR and OPTOMETRIST. RLS enforces that role boundary; the
 * ophthalmology check is applied here because profiles.specialty is free text
 * and cannot be matched reliably inside a policy.
 */
export async function saveOpticalPower(
  _prevState: OpticalPowerFormState,
  formData: FormData,
): Promise<OpticalPowerFormState> {
  const profile = await requireRole(["DOCTOR", "OPTOMETRIST"]);
  const clinicId = requireClinicId(profile);

  if (!recordsOpticalPower(profile)) {
    return {
      error: "Your profile is not set up to record optical power.",
      success: false,
    };
  }

  const consultationId = String(formData.get("consultation_id") ?? "");
  if (!consultationId) return { error: "Missing consultation reference.", success: false };

  const supabase = await createClient();

  const { data: consultation } = await supabase
    .from("consultations")
    .select("id, patient_id, status")
    .eq("id", consultationId)
    .eq("clinic_id", clinicId)
    .maybeSingle<Pick<Consultation, "id" | "patient_id" | "status">>();

  if (!consultation) return { error: "Consultation not found.", success: false };
  if (!isConsultationEditable(consultation.status)) {
    return { error: "This consultation is closed.", success: false };
  }

  const fields: Record<string, number | null> = {};

  for (const key of [
    "right_eye_sph",
    "right_eye_cyl",
    "right_eye_add",
    "left_eye_sph",
    "left_eye_cyl",
    "left_eye_add",
    "pupil_distance",
  ]) {
    const value = readDioptre(formData, key);
    if (typeof value === "string") return { error: value, success: false };
    fields[key] = value;
  }

  for (const key of ["right_eye_axis", "left_eye_axis"]) {
    const value = readAxis(formData, key);
    if (typeof value === "string") return { error: value, success: false };
    fields[key] = value;
  }

  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { data: existing } = await supabase
    .from("optical_power")
    .select("id")
    .eq("consultation_id", consultationId)
    .eq("clinic_id", clinicId)
    .maybeSingle<{ id: string }>();

  const { error } = existing
    ? await supabase
        .from("optical_power")
        .update({ ...fields, notes, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("clinic_id", clinicId)
    : await supabase.from("optical_power").insert({
        clinic_id: clinicId,
        consultation_id: consultationId,
        patient_id: consultation.patient_id,
        date_recorded: new Date().toISOString().slice(0, 10),
        ...fields,
        notes,
        created_by: profile.id,
      });

  if (error) return { error: `Could not save optical power: ${error.message}`, success: false };

  revalidatePath(`/consultations/${consultationId}`);
  return { error: null, success: true };
}
