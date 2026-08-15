import Typography from "@mui/material/Typography";

import { PatientForm } from "@/components/patients/PatientForm";
import { createPatient } from "@/features/patients/actions";
import { requireRole } from "@/lib/auth/session";
import { CLINICAL_WRITE_ROLES } from "@/types/user";

export default async function NewPatientPage() {
  await requireRole(CLINICAL_WRITE_ROLES);

  return (
    <>
      <Typography variant="h1" component="h1" gutterBottom>
        Register patient
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        A patient number is allocated automatically for your clinic.
      </Typography>
      <PatientForm action={createPatient} submitLabel="Register patient" />
    </>
  );
}
