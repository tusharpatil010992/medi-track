import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

import { PatientForm } from "@/components/patients/PatientForm";
import { updatePatient } from "@/features/patients/actions";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { patientDisplayName, type Patient } from "@/types/patient";
import { CLINICAL_WRITE_ROLES } from "@/types/user";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(CLINICAL_WRITE_ROLES);
  const clinicId = requireClinicId(profile);
  const { id } = await params;

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .maybeSingle<Patient>();

  if (!patient) notFound();

  return (
    <>
      <Typography variant="h1" component="h1" gutterBottom>
        Edit {patientDisplayName(patient)}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {patient.patient_number} — changes are recorded in the patient&apos;s history.
      </Typography>
      <PatientForm action={updatePatient} patient={patient} submitLabel="Save changes" />
    </>
  );
}
