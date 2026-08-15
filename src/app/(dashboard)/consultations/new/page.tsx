import Typography from "@mui/material/Typography";

import { NewConsultationForm } from "@/components/consultations/NewConsultationForm";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Appointment } from "@/types/appointment";
import { patientDisplayName, type Patient } from "@/types/patient";

export default async function NewConsultationPage() {
  const profile = await requireRole(["DOCTOR"]);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: patients }, { data: appointments }, { data: consulted }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, first_name, last_name, patient_number")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("first_name")
      .returns<Pick<Patient, "id" | "first_name" | "last_name" | "patient_number">[]>(),
    supabase
      .from("appointments")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", profile.id)
      .eq("appointment_date", today)
      .in("status", ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"])
      .order("appointment_time")
      .returns<Appointment[]>(),
    supabase
      .from("consultations")
      .select("appointment_id")
      .eq("clinic_id", clinicId)
      .not("appointment_id", "is", null)
      .returns<{ appointment_id: string }[]>(),
  ]);

  // An appointment already consulted must not be offered twice — appointment_id
  // is UNIQUE on consultations.
  const alreadyConsulted = new Set((consulted ?? []).map((row) => row.appointment_id));
  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));

  const appointmentOptions = (appointments ?? [])
    .filter((appointment) => !alreadyConsulted.has(appointment.id))
    .map((appointment) => {
      const patient = patientById.get(appointment.patient_id);
      return {
        id: appointment.id,
        patientId: appointment.patient_id,
        label: `${appointment.appointment_time.slice(0, 5)} — ${
          patient ? patientDisplayName(patient) : "Unknown patient"
        }`,
      };
    });

  const patientOptions = (patients ?? []).map((patient) => ({
    id: patient.id,
    label: `${patientDisplayName(patient)} (${patient.patient_number})`,
  }));

  return (
    <>
      <Typography variant="h1" component="h1" gutterBottom>
        Open consultation
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Start from one of today&apos;s appointments, or open a walk-in consultation for any patient.
      </Typography>

      <NewConsultationForm appointments={appointmentOptions} patients={patientOptions} />
    </>
  );
}
