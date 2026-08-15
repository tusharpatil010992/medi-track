"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import type { PatientFormState } from "@/features/patients/actions";
import { BLOOD_GROUPS, GENDER_OPTIONS, type Patient } from "@/types/patient";

const INITIAL_STATE: PatientFormState = { error: null, patientId: null };

interface PatientFormProps {
  action: (state: PatientFormState, formData: FormData) => Promise<PatientFormState>;
  /** Present when editing; absent when registering. */
  patient?: Patient;
  submitLabel: string;
}

export function PatientForm({ action, patient, submitLabel }: PatientFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.patientId) router.push(`/patients/${state.patientId}`);
  }, [state.patientId, router]);

  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 720 }}>
      <form action={formAction} noValidate>
        {patient ? <input type="hidden" name="patient_id" value={patient.id} /> : null}

        <Stack spacing={2}>
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}

          <Typography variant="h5">Identity</Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              name="first_name"
              label="First name"
              required
              fullWidth
              defaultValue={patient?.first_name ?? ""}
            />
            <TextField
              name="last_name"
              label="Last name"
              required
              fullWidth
              defaultValue={patient?.last_name ?? ""}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              name="date_of_birth"
              type="date"
              label="Date of birth"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              defaultValue={patient?.date_of_birth ?? ""}
            />

            <FormControl fullWidth>
              <InputLabel id="gender-label">Gender</InputLabel>
              <Select
                labelId="gender-label"
                name="gender"
                label="Gender"
                defaultValue={patient?.gender ?? ""}
              >
                <MenuItem value="">
                  <em>Not recorded</em>
                </MenuItem>
                {GENDER_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="blood-label">Blood group</InputLabel>
              <Select
                labelId="blood-label"
                name="blood_group"
                label="Blood group"
                defaultValue={patient?.blood_group ?? ""}
              >
                <MenuItem value="">
                  <em>Unknown</em>
                </MenuItem>
                {BLOOD_GROUPS.map((group) => (
                  <MenuItem key={group} value={group}>
                    {group}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Divider sx={{ my: 1 }} />
          <Typography variant="h5">Contact</Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              name="phone"
              label="Phone"
              fullWidth
              defaultValue={patient?.phone ?? ""}
            />
            <TextField
              name="email"
              type="email"
              label="Email"
              fullWidth
              defaultValue={patient?.email ?? ""}
            />
          </Stack>

          <TextField
            name="address"
            label="Address"
            fullWidth
            multiline
            rows={2}
            defaultValue={patient?.address ?? ""}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField name="city" label="City" fullWidth defaultValue={patient?.city ?? ""} />
            <TextField name="state" label="State" fullWidth defaultValue={patient?.state ?? ""} />
            <TextField
              name="postal_code"
              label="Postal code"
              fullWidth
              defaultValue={patient?.postal_code ?? ""}
            />
            <TextField
              name="country"
              label="Country"
              fullWidth
              defaultValue={patient?.country ?? ""}
            />
          </Stack>

          <Divider sx={{ my: 1 }} />
          <Typography variant="h5">Emergency contact</Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              name="emergency_contact_name"
              label="Name"
              fullWidth
              defaultValue={patient?.emergency_contact_name ?? ""}
            />
            <TextField
              name="emergency_contact_phone"
              label="Phone"
              fullWidth
              defaultValue={patient?.emergency_contact_phone ?? ""}
            />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
            <SubmitButton>{submitLabel}</SubmitButton>
            <Button
              component={Link}
              href={patient ? `/patients/${patient.id}` : "/patients"}
              variant="text"
            >
              Cancel
            </Button>
          </Stack>
        </Stack>
      </form>
    </Paper>
  );
}
