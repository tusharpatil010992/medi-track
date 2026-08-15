import EditIcon from "@mui/icons-material/Edit";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusChip } from "@/components/common/StatusChip";
import { PatientStatusToggle } from "@/components/patients/PatientStatusToggle";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  APPOINTMENT_STATUS_LABELS,
  type Appointment,
  type AppointmentStatus,
} from "@/types/appointment";
import { patientAge, patientDisplayName, type Patient, type PatientHistoryEntry } from "@/types/patient";
import { CLINIC_MEMBER_ROLES, canWriteClinicalData } from "@/types/user";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value || "—"}</Typography>
    </Stack>
  );
}

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(CLINIC_MEMBER_ROLES);
  const clinicId = requireClinicId(profile);
  const { id } = await params;

  const supabase = await createClient();

  // Scoped by clinic_id: an id from another clinic resolves to nothing.
  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .maybeSingle<Patient>();

  if (!patient) notFound();

  const [{ data: history }, { data: appointments }] = await Promise.all([
    supabase
      .from("patient_history")
      .select("*")
      .eq("patient_id", id)
      .eq("clinic_id", clinicId)
      .order("changed_at", { ascending: false })
      .limit(20)
      .returns<PatientHistoryEntry[]>(),
    supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", id)
      .eq("clinic_id", clinicId)
      .order("appointment_date", { ascending: false })
      .limit(10)
      .returns<Appointment[]>(),
  ]);

  const canWrite = canWriteClinicalData(profile.role);
  const age = patientAge(patient.date_of_birth);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <div>
          <Typography variant="h1" component="h1">
            {patientDisplayName(patient)}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {patient.patient_number}
            </Typography>
            <StatusChip isActive={patient.is_active} />
          </Stack>
        </div>

        {canWrite ? (
          <Stack direction="row" spacing={1}>
            <Button
              component={Link}
              href={`/patients/${patient.id}/edit`}
              variant="contained"
              startIcon={<EditIcon />}
            >
              Edit
            </Button>
            <PatientStatusToggle patientId={patient.id} isActive={patient.is_active} />
          </Stack>
        ) : null}
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h4" component="h2" gutterBottom>
            Details
          </Typography>
          <Field label="Date of birth" value={patient.date_of_birth} />
          <Field label="Age" value={age === null ? null : String(age)} />
          <Field label="Gender" value={patient.gender} />
          <Field label="Blood group" value={patient.blood_group} />
          <Divider sx={{ my: 2 }} />
          <Field label="Phone" value={patient.phone} />
          <Field label="Email" value={patient.email} />
          <Field
            label="Address"
            value={[patient.address, patient.city, patient.state, patient.postal_code, patient.country]
              .filter(Boolean)
              .join(", ") || null}
          />
          <Divider sx={{ my: 2 }} />
          <Field label="Emergency contact" value={patient.emergency_contact_name} />
          <Field label="Emergency phone" value={patient.emergency_contact_phone} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h4" component="h2" gutterBottom>
            Recent appointments
          </Typography>
          {!appointments || appointments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No appointments recorded.
            </Typography>
          ) : (
            <Stack divider={<Divider />}>
              {appointments.map((appointment) => (
                <Stack
                  key={appointment.id}
                  direction="row"
                  spacing={2}
                  sx={{ py: 1, justifyContent: "space-between" }}
                >
                  <Typography variant="body2">
                    {appointment.appointment_date} at {appointment.appointment_time.slice(0, 5)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {APPOINTMENT_STATUS_LABELS[appointment.status as AppointmentStatus]}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h4" component="h2" gutterBottom>
          Change history
        </Typography>
        {!history || history.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No changes recorded.
          </Typography>
        ) : (
          <Stack divider={<Divider />}>
            {history.map((entry) => (
              <Stack
                key={entry.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ py: 1, justifyContent: "space-between" }}
              >
                <Typography variant="body2">{entry.change_type.replaceAll("_", " ")}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(entry.changed_at).toLocaleString()}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
