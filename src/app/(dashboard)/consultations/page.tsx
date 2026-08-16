import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
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
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CONSULTATION_STATUS_LABELS, type Consultation } from "@/types/clinical";
import { patientDisplayName, type Patient } from "@/types/patient";
import { CLINIC_MEMBER_ROLES } from "@/types/user";

const STATUS_COLOR = {
  DRAFT: "default",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "error",
} as const;

export default async function ConsultationsPage() {
  const profile = await requireRole(CLINIC_MEMBER_ROLES);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();
  const { data: consultations } = await supabase
    .from("consultations")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("consultation_date", { ascending: false })
    .limit(50)
    .returns<Consultation[]>();

  const patientIds = [...new Set((consultations ?? []).map((c) => c.patient_id))];
  const { data: patients } = patientIds.length
    ? await supabase
        .from("patients")
        .select("id, first_name, last_name, patient_number")
        .in("id", patientIds)
        .eq("clinic_id", clinicId)
        .returns<Pick<Patient, "id" | "first_name" | "last_name" | "patient_number">[]>()
    : { data: [] };

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));
  const canOpen = profile.role === "DOCTOR";

  const newButton = canOpen ? (
    <Button component={Link} href="/consultations/new" variant="contained" startIcon={<AddIcon />}>
      Open consultation
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
          Consultations
        </Typography>
        {newButton}
      </Stack>

      {!consultations || consultations.length === 0 ? (
        <Paper variant="outlined">
          <EmptyState title="No consultations yet" action={newButton} />
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Reference</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Date</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Diagnosis</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Type</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {consultations.map((consultation) => {
                const patient = patientById.get(consultation.patient_id);

                return (
                  <TableRow key={consultation.id} hover>
                    <TableCell>
                      <Link href={`/consultations/${consultation.id}`}>
                        {consultation.consultation_number}
                      </Link>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      {consultation.consultation_date}
                    </TableCell>
                    <TableCell>
                      {patient
                        ? `${patientDisplayName(patient)} (${patient.patient_number})`
                        : "—"}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      {consultation.diagnosis ?? "—"}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      {consultation.appointment_id ? "Booked" : "Walk-in"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={CONSULTATION_STATUS_LABELS[consultation.status]}
                        color={STATUS_COLOR[consultation.status]}
                      />
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
