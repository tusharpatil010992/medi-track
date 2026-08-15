"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import { createAppointment, type AppointmentFormState } from "@/features/appointments/actions";
import { DAY_NAMES, type DoctorAvailability } from "@/types/appointment";

const INITIAL_STATE: AppointmentFormState = { error: null, appointmentId: null };
const DURATIONS = [15, 20, 30, 45, 60];

interface Option {
  id: string;
  label: string;
}

interface NewAppointmentFormProps {
  patients: Option[];
  doctors: Option[];
  availability: DoctorAvailability[];
}

export function NewAppointmentForm({ patients, doctors, availability }: NewAppointmentFormProps) {
  const [state, formAction] = useActionState(createAppointment, INITIAL_STATE);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (state.appointmentId) router.push("/appointments");
  }, [state.appointmentId, router]);

  // Surface the doctor's published windows for the chosen weekday, so the user
  // can see valid times before submitting. The server validates regardless.
  const windowsForDay = (() => {
    if (!doctorId || !date) return null;

    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (Number.isNaN(dayOfWeek)) return null;

    return availability.filter(
      (slot) => slot.doctor_id === doctorId && slot.day_of_week === dayOfWeek,
    );
  })();

  const disabled = patients.length === 0 || doctors.length === 0;

  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 640 }}>
      <form action={formAction} noValidate>
        <Stack spacing={2}>
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}

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

          <FormControl fullWidth required>
            <InputLabel id="doctor-label">Doctor</InputLabel>
            <Select
              labelId="doctor-label"
              name="doctor_id"
              label="Doctor"
              value={doctorId}
              onChange={(event) => setDoctorId(event.target.value)}
            >
              {doctors.map((doctor) => (
                <MenuItem key={doctor.id} value={doctor.id}>
                  {doctor.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              name="appointment_date"
              type="date"
              label="Date"
              required
              fullWidth
              value={date}
              onChange={(event) => setDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              name="appointment_time"
              type="time"
              label="Time"
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControl fullWidth>
              <InputLabel id="duration-label">Duration</InputLabel>
              <Select
                labelId="duration-label"
                name="duration_minutes"
                label="Duration"
                defaultValue={30}
              >
                {DURATIONS.map((minutes) => (
                  <MenuItem key={minutes} value={minutes}>
                    {minutes} minutes
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {windowsForDay ? (
            <FormHelperText component="div">
              {windowsForDay.length === 0 ? (
                <Alert severity="warning">
                  This doctor publishes no availability on{" "}
                  {DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()]}.
                </Alert>
              ) : (
                <>
                  Available:{" "}
                  {windowsForDay
                    .map((slot) => `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`)
                    .join(", ")}
                </>
              )}
            </FormHelperText>
          ) : null}

          <TextField name="reason_for_visit" label="Reason for visit" fullWidth />
          <TextField name="notes" label="Notes" fullWidth multiline rows={2} />

          <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
            <SubmitButton>{disabled ? "Unavailable" : "Book appointment"}</SubmitButton>
            <Button component={Link} href="/appointments" variant="text">
              Cancel
            </Button>
          </Stack>
        </Stack>
      </form>
    </Paper>
  );
}
