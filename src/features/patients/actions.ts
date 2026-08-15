"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Patient } from "@/types/patient";

/** Roles permitted to write patient records. ADMIN and OPTOMETRIST are read-only. */
const PATIENT_WRITERS = ["FRONT_DESK", "DOCTOR"] as const;

export interface PatientFormState {
  error: string | null;
  patientId: string | null;
}

interface PatientFields {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

function readFields(formData: FormData): PatientFields {
  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;

  return {
    first_name: String(formData.get("first_name") ?? "").trim(),
    last_name: String(formData.get("last_name") ?? "").trim(),
    email: text("email"),
    phone: text("phone"),
    date_of_birth: text("date_of_birth"),
    gender: text("gender"),
    blood_group: text("blood_group"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    postal_code: text("postal_code"),
    country: text("country"),
    emergency_contact_name: text("emergency_contact_name"),
    emergency_contact_phone: text("emergency_contact_phone"),
  };
}

function validate(fields: PatientFields): string | null {
  if (!fields.first_name) return "First name is required.";
  if (!fields.last_name) return "Last name is required.";
  if (fields.email && !fields.email.includes("@")) return "Enter a valid email address.";

  if (fields.date_of_birth) {
    const dob = new Date(fields.date_of_birth);
    if (Number.isNaN(dob.getTime())) return "Enter a valid date of birth.";
    if (dob > new Date()) return "Date of birth cannot be in the future.";
  }

  return null;
}

/**
 * Allocates the next patient number for a clinic, e.g. P-0007.
 *
 * Each clinic numbers independently. Read-then-insert races are possible, so
 * the caller retries on the unique-violation raised by
 * patients_clinic_number_unique.
 */
async function nextPatientNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
): Promise<string> {
  const { data } = await supabase
    .from("patients")
    .select("patient_number")
    .eq("clinic_id", clinicId)
    .like("patient_number", "P-%")
    .order("patient_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ patient_number: string }>();

  const highest = data ? Number(data.patient_number.replace("P-", "")) : 0;
  const next = Number.isFinite(highest) ? highest + 1 : 1;

  return `P-${String(next).padStart(4, "0")}`;
}

export async function createPatient(
  _prevState: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const profile = await requireRole(PATIENT_WRITERS);
  const clinicId = requireClinicId(profile);

  const fields = readFields(formData);
  const invalid = validate(fields);
  if (invalid) return { error: invalid, patientId: null };

  const supabase = await createClient();

  // Retry covers two front-desk registrations racing for the same number.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const patientNumber = await nextPatientNumber(supabase, clinicId);

    const { data, error } = await supabase
      .from("patients")
      .insert({
        clinic_id: clinicId,
        patient_number: patientNumber,
        ...fields,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("id")
      .single<{ id: string }>();

    if (!error && data) {
      await supabase.from("patient_history").insert({
        clinic_id: clinicId,
        patient_id: data.id,
        change_type: "PATIENT_CREATED",
        new_data: { patient_number: patientNumber, ...fields },
        changed_by: profile.id,
      });

      revalidatePath("/patients");
      return { error: null, patientId: data.id };
    }

    // 23505 = unique_violation. Anything else is not worth retrying.
    if (error?.code !== "23505") {
      return { error: `Could not register patient: ${error?.message}`, patientId: null };
    }
  }

  return { error: "Could not allocate a patient number. Please try again.", patientId: null };
}

export async function updatePatient(
  _prevState: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const profile = await requireRole(PATIENT_WRITERS);
  const clinicId = requireClinicId(profile);

  const patientId = String(formData.get("patient_id") ?? "");
  if (!patientId) return { error: "Missing patient reference.", patientId: null };

  const fields = readFields(formData);
  const invalid = validate(fields);
  if (invalid) return { error: invalid, patientId: null };

  const supabase = await createClient();

  // Scoped by clinic_id so a guessed id from another clinic cannot be reached.
  const { data: existing } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle<Patient>();

  if (!existing) return { error: "Patient not found.", patientId: null };

  const { error } = await supabase
    .from("patients")
    .update({ ...fields, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", patientId)
    .eq("clinic_id", clinicId);

  if (error) return { error: `Could not save patient: ${error.message}`, patientId: null };

  await supabase.from("patient_history").insert({
    clinic_id: clinicId,
    patient_id: patientId,
    change_type: "PATIENT_UPDATED",
    previous_data: {
      first_name: existing.first_name,
      last_name: existing.last_name,
      email: existing.email,
      phone: existing.phone,
    },
    new_data: fields,
    changed_by: profile.id,
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);

  return { error: null, patientId };
}

/** Deactivates or reactivates a patient. Never deletes — history must survive. */
export async function setPatientActive(patientId: string, isActive: boolean): Promise<void> {
  const profile = await requireRole(PATIENT_WRITERS);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();
  await supabase
    .from("patients")
    .update({ is_active: isActive, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", patientId)
    .eq("clinic_id", clinicId);

  await supabase.from("patient_history").insert({
    clinic_id: clinicId,
    patient_id: patientId,
    change_type: isActive ? "PATIENT_REACTIVATED" : "PATIENT_DEACTIVATED",
    changed_by: profile.id,
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
}
