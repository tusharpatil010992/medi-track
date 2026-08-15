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

import { AppointmentStatusChip } from "@/components/appointments/AppointmentStatusChip";
import { AppointmentActions } from "@/components/appointments/AppointmentActions";
import { DayPicker } from "@/components/appointments/DayPicker";
import { EmptyState } from "@/components/common/EmptyState";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Appointment } from "@/types/appointment";
import { patientDisplayName, type Patient } from "@/types/patient";
import { CLINIC_MEMBER_ROLES, canWriteClinicalData } from "@/types/user";
import type { Profile } from "@/types/user";

/** Today in YYYY-MM-DD. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const profile = await requireRole(CLINIC_MEMBER_ROLES);
  const clinicId = requireClinicId(profile);
  const { date } = await searchParams;
  const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today();

  const supabase = await createClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("appointment_date", selectedDate)
    .order("appointment_time", { ascending: true })
    .returns<Appointment[]>();

  // Resolve names for the rows on screen rather than joining, keeping the
  // query simple and the row count small.
  const patientIds = [...new Set((appointments ?? []).map((a) => a.patient_id))];
  const doctorIds = [...new Set((appointments ?? []).map((a) => a.doctor_id))];

  const [{ data: patients }, { data: doctors }] = await Promise.all([
    patientIds.length
      ? supabase
          .from("patients")
          .select("id, first_name, last_name, patient_number")
          .in("id", patientIds)
          .eq("clinic_id", clinicId)
          .returns<Pick<Patient, "id" | "first_name" | "last_name" | "patient_number">[]>()
      : Promise.resolve({ data: [] as Pick<Patient, "id" | "first_name" | "last_name" | "patient_number">[] }),
    doctorIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", doctorIds)
          .eq("clinic_id", clinicId)
          .returns<Pick<Profile, "id" | "full_name">[]>()
      : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name">[] }),
  ]);

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));
  const doctorById = new Map((doctors ?? []).map((d) => [d.id, d]));
  const canWrite = canWriteClinicalData(profile.role);

  const bookButton = canWrite ? (
    <Button component={Link} href="/appointments/new" variant="contained" startIcon={<AddIcon />}>
      Book appointment
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
          Appointments
        </Typography>
        {bookButton}
      </Stack>

      <DayPicker selectedDate={selectedDate} />

      {!appointments || appointments.length === 0 ? (
        <Paper variant="outlined">
          <EmptyState
            title="Nothing booked for this day"
            description="Pick another date, or book an appointment."
            action={bookButton}
          />
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Doctor</TableCell>
                <TableCell>Status</TableCell>
                {canWrite ? <TableCell align="right">Actions</TableCell> : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {appointments.map((appointment) => {
                const patient = patientById.get(appointment.patient_id);
                const doctor = doctorById.get(appointment.doctor_id);

                return (
                  <TableRow key={appointment.id} hover>
                    <TableCell>
                      {appointment.appointment_time.slice(0, 5)}
                      <Typography variant="caption" color="text.secondary" component="div">
                        {appointment.duration_minutes} min
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {patient ? (
                        <Link href={`/patients/${patient.id}`}>{patientDisplayName(patient)}</Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      {doctor?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <AppointmentStatusChip status={appointment.status} />
                    </TableCell>
                    {canWrite ? (
                      <TableCell align="right">
                        <AppointmentActions
                          appointmentId={appointment.id}
                          status={appointment.status}
                        />
                      </TableCell>
                    ) : null}
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
