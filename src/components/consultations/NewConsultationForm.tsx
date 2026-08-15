"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import {
  createConsultation,
  type ConsultationFormState,
} from "@/features/consultations/actions";

const INITIAL_STATE: ConsultationFormState = { error: null, consultationId: null };

interface AppointmentOption {
  id: string;
  patientId: string;
  label: string;
}

export function NewConsultationForm({
  appointments,
  patients,
}: {
  appointments: AppointmentOption[];
  patients: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState(createConsultation, INITIAL_STATE);
  const [mode, setMode] = useState<"appointment" | "walkin">(
    appointments.length > 0 ? "appointment" : "walkin",
  );
  const [appointmentId, setAppointmentId] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (state.consultationId) router.push(`/consultations/${state.consultationId}`);
  }, [state.consultationId, router]);

  const selectedAppointment = appointments.find((a) => a.id === appointmentId);

  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 640 }}>
      <form action={formAction} noValidate>
        <Stack spacing={2}>
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}

          <RadioGroup
            value={mode}
            onChange={(event) => setMode(event.target.value as "appointment" | "walkin")}
          >
            <FormControlLabel
              value="appointment"
              control={<Radio />}
              label="From today's appointments"
              disabled={appointments.length === 0}
            />
            <FormControlLabel value="walkin" control={<Radio />} label="Walk-in" />
          </RadioGroup>

          {appointments.length === 0 ? (
            <Alert severity="info">
              You have no remaining appointments today. Open a walk-in instead.
            </Alert>
          ) : null}

          {mode === "appointment" ? (
            <>
              <FormControl fullWidth required>
                <InputLabel id="appointment-label">Appointment</InputLabel>
                <Select
                  labelId="appointment-label"
                  label="Appointment"
                  value={appointmentId}
                  onChange={(event) => setAppointmentId(event.target.value)}
                >
                  {appointments.map((appointment) => (
                    <MenuItem key={appointment.id} value={appointment.id}>
                      {appointment.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <input type="hidden" name="appointment_id" value={appointmentId} />
              <input type="hidden" name="patient_id" value={selectedAppointment?.patientId ?? ""} />
            </>
          ) : (
            <FormControl fullWidth required>
              <InputLabel id="patient-label">Patient</InputLabel>
              <Select labelId="patient-label" name="patient_id" label="Patient" defaultValue="">
                {patients.map((patient) => (
                  <MenuItem key={patient.id} value={patient.id}>
                    {patient.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
            <SubmitButton>Open consultation</SubmitButton>
            <Button component={Link} href="/consultations" variant="text">
              Cancel
            </Button>
          </Stack>
        </Stack>
      </form>
    </Paper>
  );
}
