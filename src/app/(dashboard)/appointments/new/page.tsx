import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";

import { NewAppointmentForm } from "@/components/appointments/NewAppointmentForm";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { DoctorAvailability } from "@/types/appointment";
import { patientDisplayName, type Patient } from "@/types/patient";
import { CLINICAL_WRITE_ROLES, type Profile } from "@/types/user";

export default async function NewAppointmentPage() {
  const profile = await requireRole(CLINICAL_WRITE_ROLES);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();

  const [{ data: patients }, { data: doctors }, { data: availability }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, first_name, last_name, patient_number")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("first_name")
      .returns<Pick<Patient, "id" | "first_name" | "last_name" | "patient_number">[]>(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", clinicId)
      .eq("role", "DOCTOR")
      .eq("is_active", true)
      .order("full_name")
      .returns<Pick<Profile, "id" | "full_name">[]>(),
    supabase
      .from("doctor_availability")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .returns<DoctorAvailability[]>(),
  ]);

  const patientOptions = (patients ?? []).map((patient) => ({
    id: patient.id,
    label: `${patientDisplayName(patient)} (${patient.patient_number})`,
  }));

  const doctorOptions = (doctors ?? []).map((doctor) => ({
    id: doctor.id,
    label: doctor.full_name,
  }));

  return (
    <>
      <Typography variant="h1" component="h1" gutterBottom>
        Book appointment
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The slot is checked against the doctor&apos;s availability and existing bookings before it
        is saved.
      </Typography>

      {patientOptions.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No active patients yet — register a patient first.
        </Alert>
      ) : null}

      {doctorOptions.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No active doctors in this clinic. An administrator needs to add one.
        </Alert>
      ) : null}

      <NewAppointmentForm
        patients={patientOptions}
        doctors={doctorOptions}
        availability={availability ?? []}
      />
    </>
  );
}
