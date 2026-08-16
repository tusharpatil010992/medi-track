"use server";

import { revalidatePath } from "next/cache";

import { consultationBillingBlocker } from "@/features/billing/consultation-billing";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { notifyPatient } from "@/lib/notifications/dispatch";
import { createClient } from "@/lib/supabase/server";
import {
  BLOCKING_STATUSES,
  intervalsOverlap,
  timeToMinutes,
  type AppointmentStatus,
} from "@/types/appointment";
import type { Profile } from "@/types/user";

/** Roles permitted to write appointments. ADMIN and OPTOMETRIST are read-only. */
const APPOINTMENT_WRITERS = ["FRONT_DESK", "DOCTOR"] as const;

/** Statuses that cannot be transitioned out of. */
const TERMINAL_STATUSES: readonly AppointmentStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
];

export interface AppointmentFormState {
  error: string | null;
  appointmentId: string | null;
}

/** Outcome of a status change, so a refused transition can explain itself in the UI. */
export interface StatusChangeResult {
  error: string | null;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** The doctor's name for a patient-facing message. Falls back to a neutral label. */
async function doctorName(
  supabase: SupabaseClient,
  clinicId: string,
  doctorId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", doctorId)
    .eq("clinic_id", clinicId)
    .maybeSingle<Pick<Profile, "full_name">>();

  return data?.full_name ?? "your clinician";
}

interface SlotRequest {
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  durationMinutes: number;
}

/**
 * Server-side validation for a proposed slot.
 *
 * Checks, in order: both parties belong to the acting user's clinic; the doctor
 * publishes availability covering the slot; nothing already occupies it.
 * Returns an error message, or null when the slot is bookable.
 *
 * `excludeAppointmentId` lets a reschedule ignore the booking being replaced.
 */
async function validateSlot(
  supabase: SupabaseClient,
  clinicId: string,
  slot: SlotRequest,
  excludeAppointmentId?: string,
): Promise<string | null> {
  if (!slot.patientId || !slot.doctorId) return "Select both a patient and a doctor.";
  if (!slot.date || !slot.time) return "Select a date and time.";
  if (slot.durationMinutes <= 0) return "Duration must be greater than zero.";

  const appointmentDate = new Date(`${slot.date}T00:00:00Z`);
  if (Number.isNaN(appointmentDate.getTime())) return "Enter a valid date.";

  // Ownership: both records must sit in the caller's clinic. Filtering by
  // clinic_id means an id borrowed from another clinic simply finds nothing.
  const { data: patient } = await supabase
    .from("patients")
    .select("id, is_active")
    .eq("id", slot.patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle<{ id: string; is_active: boolean }>();

  if (!patient) return "Patient not found in this clinic.";
  if (!patient.is_active) return "This patient is deactivated.";

  const { data: doctor } = await supabase
    .from("profiles")
    .select("id, is_active, role")
    .eq("id", slot.doctorId)
    .eq("clinic_id", clinicId)
    .maybeSingle<{ id: string; is_active: boolean; role: string }>();

  if (!doctor) return "Doctor not found in this clinic.";
  if (!doctor.is_active) return "This doctor is deactivated.";
  if (doctor.role !== "DOCTOR") return "Appointments can only be booked with a doctor.";

  const start = timeToMinutes(slot.time);
  const end = start + slot.durationMinutes;

  // Availability: the slot must sit inside a published window for that weekday.
  const dayOfWeek = appointmentDate.getUTCDay();
  const { data: availability } = await supabase
    .from("doctor_availability")
    .select("start_time, end_time")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", slot.doctorId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .returns<{ start_time: string; end_time: string }[]>();

  const covered = (availability ?? []).some(
    (window) => start >= timeToMinutes(window.start_time) && end <= timeToMinutes(window.end_time),
  );

  if (!covered) return "The doctor is not available at that time.";

  // Conflicts: only statuses that still occupy the doctor's time count.
  let query = supabase
    .from("appointments")
    .select("id, appointment_time, duration_minutes")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", slot.doctorId)
    .eq("appointment_date", slot.date)
    .in("status", [...BLOCKING_STATUSES]);

  if (excludeAppointmentId) query = query.neq("id", excludeAppointmentId);

  const { data: sameDay } = await query.returns<
    { id: string; appointment_time: string; duration_minutes: number }[]
  >();

  const clash = (sameDay ?? []).some((existing) => {
    const existingStart = timeToMinutes(existing.appointment_time);
    return intervalsOverlap(start, end, existingStart, existingStart + existing.duration_minutes);
  });

  if (clash) return "That slot overlaps an existing appointment for this doctor.";

  return null;
}

function readSlot(formData: FormData): SlotRequest {
  return {
    patientId: String(formData.get("patient_id") ?? ""),
    doctorId: String(formData.get("doctor_id") ?? ""),
    date: String(formData.get("appointment_date") ?? ""),
    time: String(formData.get("appointment_time") ?? ""),
    durationMinutes: Number(formData.get("duration_minutes") ?? 30),
  };
}

export async function createAppointment(
  _prevState: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const profile = await requireRole(APPOINTMENT_WRITERS);
  const clinicId = requireClinicId(profile);

  const slot = readSlot(formData);
  const supabase = await createClient();

  const invalid = await validateSlot(supabase, clinicId, slot);
  if (invalid) return { error: invalid, appointmentId: null };

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinicId,
      patient_id: slot.patientId,
      doctor_id: slot.doctorId,
      appointment_date: slot.date,
      appointment_time: slot.time,
      duration_minutes: slot.durationMinutes,
      status: "SCHEDULED",
      reason_for_visit: String(formData.get("reason_for_visit") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { error: `Could not book appointment: ${error?.message}`, appointmentId: null };
  }

  await notifyPatient({
    clinicId,
    patientId: slot.patientId,
    event: {
      type: "APPOINTMENT_CREATED",
      doctorName: await doctorName(supabase, clinicId, slot.doctorId),
      date: slot.date,
      time: slot.time,
    },
    relatedEntityType: "appointment",
    relatedEntityId: data.id,
  });

  revalidatePath("/appointments");
  return { error: null, appointmentId: data.id };
}

/**
 * Reschedules by superseding: the original is marked RESCHEDULED and a new
 * booking is created. The original row is preserved rather than overwritten, so
 * the history of what was booked when survives.
 */
export async function rescheduleAppointment(
  _prevState: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const profile = await requireRole(APPOINTMENT_WRITERS);
  const clinicId = requireClinicId(profile);

  const appointmentId = String(formData.get("appointment_id") ?? "");
  if (!appointmentId) return { error: "Missing appointment reference.", appointmentId: null };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("appointments")
    .select("id, patient_id, doctor_id, status, reason_for_visit, notes")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .maybeSingle<{
      id: string;
      patient_id: string;
      doctor_id: string;
      status: AppointmentStatus;
      reason_for_visit: string | null;
      notes: string | null;
    }>();

  if (!existing) return { error: "Appointment not found.", appointmentId: null };
  if (TERMINAL_STATUSES.includes(existing.status)) {
    return { error: `A ${existing.status.toLowerCase()} appointment cannot be rescheduled.`, appointmentId: null };
  }

  const slot: SlotRequest = {
    patientId: existing.patient_id,
    doctorId: String(formData.get("doctor_id") ?? existing.doctor_id),
    date: String(formData.get("appointment_date") ?? ""),
    time: String(formData.get("appointment_time") ?? ""),
    durationMinutes: Number(formData.get("duration_minutes") ?? 30),
  };

  const invalid = await validateSlot(supabase, clinicId, slot, appointmentId);
  if (invalid) return { error: invalid, appointmentId: null };

  const { data: replacement, error: insertError } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinicId,
      patient_id: slot.patientId,
      doctor_id: slot.doctorId,
      appointment_date: slot.date,
      appointment_time: slot.time,
      duration_minutes: slot.durationMinutes,
      status: "SCHEDULED",
      reason_for_visit: existing.reason_for_visit,
      notes: existing.notes,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !replacement) {
    return { error: `Could not reschedule: ${insertError?.message}`, appointmentId: null };
  }

  const { error: supersedeError } = await supabase
    .from("appointments")
    .update({
      status: "RESCHEDULED",
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId);

  if (supersedeError) {
    // Roll back the replacement so the slot is not double-booked by a
    // half-applied reschedule.
    await supabase.from("appointments").delete().eq("id", replacement.id).eq("clinic_id", clinicId);
    return { error: `Could not reschedule: ${supersedeError.message}`, appointmentId: null };
  }

  await notifyPatient({
    clinicId,
    patientId: slot.patientId,
    event: {
      type: "APPOINTMENT_RESCHEDULED",
      doctorName: await doctorName(supabase, clinicId, slot.doctorId),
      date: slot.date,
      time: slot.time,
    },
    relatedEntityType: "appointment",
    relatedEntityId: replacement.id,
  });

  revalidatePath("/appointments");
  return { error: null, appointmentId: replacement.id };
}

/**
 * Moves an appointment to a new status, refusing transitions out of terminal
 * states.
 *
 * Completing the appointment is what closes the visit, and it carries the
 * billing gate: the bill must be issued and the mode of payment recorded first.
 * The gate lives here rather than on the consultation because the consultation
 * completing is what *reveals* the billing button — gating that would deadlock.
 *
 * Paying less than the total is allowed and leaves the invoice PARTIALLY_PAID;
 * a fully discounted bill needs no payment at all, its written reason standing
 * in place of the money. An appointment with no consultation was never billed
 * and completes freely.
 */
export async function setAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<StatusChangeResult> {
  const profile = await requireRole(APPOINTMENT_WRITERS);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("appointments")
    .select("status, patient_id, doctor_id, appointment_date, appointment_time")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .maybeSingle<{
      status: AppointmentStatus;
      patient_id: string;
      doctor_id: string;
      appointment_date: string;
      appointment_time: string;
    }>();

  if (!existing) return { error: "Appointment not found." };
  if (TERMINAL_STATUSES.includes(existing.status)) {
    return { error: `A ${existing.status.toLowerCase()} appointment cannot change status.` };
  }

  if (status === "COMPLETED") {
    const { data: consultation } = await supabase
      .from("consultations")
      .select("id, status")
      .eq("appointment_id", appointmentId)
      .eq("clinic_id", clinicId)
      .maybeSingle<{ id: string; status: string }>();

    if (consultation && consultation.status === "CANCELLED") {
      return { error: "This visit's consultation was cancelled, so it cannot be completed." };
    }

    if (consultation && consultation.status !== "COMPLETED") {
      return { error: "The consultation for this visit is still open. Close it first." };
    }

    if (consultation) {
      const blocker = await consultationBillingBlocker(supabase, clinicId, consultation.id);
      if (blocker) return { error: blocker };
    }
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId);

  if (error) return { error: `Could not update appointment: ${error.message}` };

  if (status === "CANCELLED") {
    await notifyPatient({
      clinicId,
      patientId: existing.patient_id,
      event: {
        type: "APPOINTMENT_CANCELLED",
        doctorName: await doctorName(supabase, clinicId, existing.doctor_id),
        date: existing.appointment_date,
        time: existing.appointment_time,
      },
      relatedEntityType: "appointment",
      relatedEntityId: appointmentId,
    });
  }

  revalidatePath("/appointments");
  return { error: null };
}
