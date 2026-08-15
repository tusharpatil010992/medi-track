"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isConsultationEditable, type Consultation, type ConsultationStatus } from "@/types/clinical";

export interface ConsultationFormState {
  error: string | null;
  consultationId: string | null;
}

/**
 * Opens a consultation, either against a booked appointment or as a walk-in.
 *
 * The doctor is always the acting user — a consultation cannot be opened on a
 * colleague's behalf. Patient and appointment are re-read filtered by the
 * caller's clinic, so ids borrowed from another clinic resolve to nothing.
 */
export async function createConsultation(
  _prevState: ConsultationFormState,
  formData: FormData,
): Promise<ConsultationFormState> {
  const profile = await requireRole(["DOCTOR"]);
  const clinicId = requireClinicId(profile);

  const patientId = String(formData.get("patient_id") ?? "");
  const appointmentId = String(formData.get("appointment_id") ?? "") || null;

  if (!patientId) return { error: "Select a patient.", consultationId: null };

  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, is_active")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle<{ id: string; is_active: boolean }>();

  if (!patient) return { error: "Patient not found in this clinic.", consultationId: null };
  if (!patient.is_active) return { error: "This patient is deactivated.", consultationId: null };

  if (appointmentId) {
    const { data: appointment } = await supabase
      .from("appointments")
      .select("id, patient_id")
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId)
      .maybeSingle<{ id: string; patient_id: string }>();

    if (!appointment) {
      return { error: "Appointment not found in this clinic.", consultationId: null };
    }
    if (appointment.patient_id !== patientId) {
      return { error: "That appointment belongs to a different patient.", consultationId: null };
    }

    const { data: existing } = await supabase
      .from("consultations")
      .select("id")
      .eq("appointment_id", appointmentId)
      .eq("clinic_id", clinicId)
      .maybeSingle<{ id: string }>();

    if (existing) {
      return { error: "This appointment already has a consultation.", consultationId: existing.id };
    }
  }

  const { data, error } = await supabase
    .from("consultations")
    .insert({
      clinic_id: clinicId,
      appointment_id: appointmentId,
      patient_id: patientId,
      doctor_id: profile.id,
      consultation_date: new Date().toISOString().slice(0, 10),
      status: "IN_PROGRESS",
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: `Could not open consultation: ${error?.message}`, consultationId: null };
  }

  // Move the appointment along so the day view reflects that the patient is
  // now with the clinician.
  if (appointmentId) {
    await supabase
      .from("appointments")
      .update({
        status: "IN_PROGRESS",
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      })
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId);
  }

  revalidatePath("/consultations");
  return { error: null, consultationId: data.id };
}

export async function updateConsultation(
  _prevState: ConsultationFormState,
  formData: FormData,
): Promise<ConsultationFormState> {
  const profile = await requireRole(["DOCTOR"]);
  const clinicId = requireClinicId(profile);

  const consultationId = String(formData.get("consultation_id") ?? "");
  if (!consultationId) return { error: "Missing consultation reference.", consultationId: null };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("consultations")
    .select("id, status")
    .eq("id", consultationId)
    .eq("clinic_id", clinicId)
    .maybeSingle<Pick<Consultation, "id" | "status">>();

  if (!existing) return { error: "Consultation not found.", consultationId: null };
  if (!isConsultationEditable(existing.status)) {
    return {
      error: `A ${existing.status.toLowerCase()} consultation can no longer be edited.`,
      consultationId: null,
    };
  }

  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;

  const { error } = await supabase
    .from("consultations")
    .update({
      chief_complaint: text("chief_complaint"),
      patient_history: text("patient_history"),
      examination_findings: text("examination_findings"),
      diagnosis: text("diagnosis"),
      treatment_plan: text("treatment_plan"),
      follow_up_date: text("follow_up_date"),
      follow_up_notes: text("follow_up_notes"),
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", consultationId)
    .eq("clinic_id", clinicId);

  if (error) return { error: `Could not save: ${error.message}`, consultationId: null };

  revalidatePath(`/consultations/${consultationId}`);
  return { error: null, consultationId };
}

/**
 * Moves a consultation through its lifecycle.
 *
 * Completing one also completes its appointment, so the day view does not leave
 * a finished patient sitting in progress.
 */
export async function setConsultationStatus(
  consultationId: string,
  status: ConsultationStatus,
): Promise<void> {
  const profile = await requireRole(["DOCTOR"]);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("consultations")
    .select("id, status, appointment_id")
    .eq("id", consultationId)
    .eq("clinic_id", clinicId)
    .maybeSingle<Pick<Consultation, "id" | "status" | "appointment_id">>();

  if (!existing) throw new Error("Consultation not found");
  if (!isConsultationEditable(existing.status)) {
    throw new Error(`A ${existing.status.toLowerCase()} consultation cannot change status`);
  }

  await supabase
    .from("consultations")
    .update({ status, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", consultationId)
    .eq("clinic_id", clinicId);

  if (status === "COMPLETED" && existing.appointment_id) {
    await supabase
      .from("appointments")
      .update({
        status: "COMPLETED",
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      })
      .eq("id", existing.appointment_id)
      .eq("clinic_id", clinicId);
  }

  revalidatePath("/consultations");
  revalidatePath(`/consultations/${consultationId}`);
}
