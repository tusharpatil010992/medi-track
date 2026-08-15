import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { EmptyState } from "@/components/common/EmptyState";
import { StatusChip } from "@/components/common/StatusChip";
import { PatientSearch } from "@/components/patients/PatientSearch";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { patientAge, patientDisplayName, type Patient } from "@/types/patient";
import { CLINIC_MEMBER_ROLES, canWriteClinicalData } from "@/types/user";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await requireRole(CLINIC_MEMBER_ROLES);
  const clinicId = requireClinicId(profile);
  const { q } = await searchParams;
  const term = q?.trim() ?? "";

  const supabase = await createClient();

  let query = supabase
    .from("patients")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (term) {
    // Escape PostgREST's or() delimiters so a comma or paren cannot break out
    // of the filter expression.
    const safe = term.replace(/[,()]/g, " ");
    query = query.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,patient_number.ilike.%${safe}%,phone.ilike.%${safe}%`,
    );
  }

  const { data: patients } = await query.returns<Patient[]>();
  const canWrite = canWriteClinicalData(profile.role);

  const registerButton = canWrite ? (
    <Button component={Link} href="/patients/new" variant="contained" startIcon={<AddIcon />}>
      Register patient
    </Button>
  ) : null;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Typography variant="h1" component="h1">
          Patients
        </Typography>
        {registerButton}
      </Stack>

      <PatientSearch defaultValue={term} />

      {!patients || patients.length === 0 ? (
        <Paper variant="outlined">
          <EmptyState
            title={term ? "No patients match that search" : "No patients yet"}
            description={term ? "Try a name, patient number or phone number." : undefined}
            action={term ? undefined : registerButton}
          />
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Number</TableCell>
                <TableCell>Name</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Age</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Phone</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {patients.map((patient) => {
                const age = patientAge(patient.date_of_birth);
                return (
                  <TableRow key={patient.id} hover>
                    <TableCell>
                      <Link href={`/patients/${patient.id}`}>{patient.patient_number}</Link>
                    </TableCell>
                    <TableCell>{patientDisplayName(patient)}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      {age === null ? "—" : age}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      {patient.phone ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusChip isActive={patient.is_active} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
