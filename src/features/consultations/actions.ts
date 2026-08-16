"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { notifyPatient } from "@/lib/notifications/dispatch";
import { createClient } from "@/lib/supabase/server";
import { isConsultationEditable, type Consultation, type ConsultationStatus } from "@/types/clinical";

export interface ConsultationFormState {
  error: string | null;
  consultationId: string | null;
}

/** Outcome of a status change, so a refused transition can explain itself in the UI. */
export interface StatusChangeResult {
  error: string | null;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Allocates the next clinic-scoped consultation reference.
 *
 * Same approach as patient and invoice numbers: read the highest, add one, and
 * let the UNIQUE(clinic_id, consultation_number) constraint plus a retry settle
 * a race between two doctors opening a visit at the same moment.
 */
async function nextConsultationNumber(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<string> {
  const { data } = await supabase
    .from("consultations")
    .select("consultation_number")
    .eq("clinic_id", clinicId)
    .like("consultation_number", "C-%")
    .order("consultation_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ consultation_number: string }>();

  const highest = data ? Number(data.consultation_number.replace("C-", "")) : 0;
  const next = Number.isFinite(highest) ? highest + 1 : 1;

  return `C-${String(next).padStart(4, "0")}`;
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

  // Retry covers two doctors opening a consultation at the same moment.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const consultationNumber = await nextConsultationNumber(supabase, clinicId);

    const { data, error } = await supabase
      .from("consultations")
      .insert({
        clinic_id: clinicId,
        consultation_number: consultationNumber,
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

    if (!error && data) {
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

    // 23505 = unique_violation on the consultation number. Nothing else retries.
    if (error?.code !== "23505") {
      return { error: `Could not open consultation: ${error?.message}`, consultationId: null };
    }
  }

  return { error: "Could not allocate a consultation number. Please try again.", consultationId: null };
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
 * Completing marks the end of the *clinical* work only, and is not gated on
 * billing — the billing button appears once this succeeds, so gating here would
 * deadlock: the bill could never be raised.
 *
 * It deliberately no longer completes the attached appointment either. The
 * visit is not over until the patient has settled at the desk, so the
 * appointment stays IN_PROGRESS and carries the billing gate itself. See
 * setAppointmentStatus().
 *
 * Returns the reason instead of throwing, so a refusal reads as a message
 * rather than an error page.
 */
export async function setConsultationStatus(
  consultationId: string,
  status: ConsultationStatus,
): Promise<StatusChangeResult> {
  const profile = await requireRole(["DOCTOR"]);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("consultations")
    .select("id, status, patient_id, follow_up_date")
    .eq("id", consultationId)
    .eq("clinic_id", clinicId)
    .maybeSingle<Pick<Consultation, "id" | "status" | "patient_id" | "follow_up_date">>();

  if (!existing) return { error: "Consultation not found." };
  if (!isConsultationEditable(existing.status)) {
    return { error: `A ${existing.status.toLowerCase()} consultation cannot change status.` };
  }

  const { error } = await supabase
    .from("consultations")
    .update({ status, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", consultationId)
    .eq("clinic_id", clinicId);

  if (error) return { error: `Could not update consultation: ${error.message}` };

  if (status === "COMPLETED") {
    await notifyPatient({
      clinicId,
      patientId: existing.patient_id,
      event: {
        type: "CONSULTATION_COMPLETED",
        doctorName: profile.full_name,
        followUpDate: existing.follow_up_date,
      },
      relatedEntityType: "consultation",
      relatedEntityId: consultationId,
    });
  }

  revalidatePath("/consultations");
  revalidatePath(`/consultations/${consultationId}`);
  revalidatePath("/appointments");

  return { error: null };
}
