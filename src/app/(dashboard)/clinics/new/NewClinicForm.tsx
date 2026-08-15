"use client";

import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useActionState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import { createClinic, type CreateClinicState } from "@/features/clinics/actions";

const INITIAL_STATE: CreateClinicState = { error: null, provisioned: null };

export function NewClinicForm() {
  const [state, formAction] = useActionState(createClinic, INITIAL_STATE);

  if (state.provisioned) {
    const { clinicName, adminEmail, temporaryPassword } = state.provisioned;

    return (
      <Stack spacing={3} sx={{ maxWidth: 640 }}>
        <Alert severity="success">
          <AlertTitle>{clinicName} created</AlertTitle>
          The administrator account is ready and a placeholder configuration was generated.
        </Alert>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Temporary credentials
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Shown once. Pass these to the administrator, who signs in at the shared login page.
          </Typography>
          <Typography variant="body2">
            <strong>Email:</strong> {adminEmail}
          </Typography>
          <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
            <strong>Password:</strong> {temporaryPassword}
          </Typography>
        </Paper>

        <Box>
          <Button component={Link} href="/clinics" variant="contained">
            Back to clinics
          </Button>
        </Box>
      </Stack>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 640 }}>
      <form action={formAction} noValidate>
        <Stack spacing={2}>
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}

          <Typography variant="h5">Clinic</Typography>
          <TextField name="name" label="Clinic name" required fullWidth />
          <TextField name="email" type="email" label="Clinic email" fullWidth />
          <TextField name="phone" label="Clinic phone" fullWidth />
          <TextField
            name="timezone"
            label="Timezone"
            defaultValue="UTC"
            fullWidth
            helperText="IANA name, for example Asia/Kolkata"
          />

          <Divider sx={{ my: 1 }} />

          <Typography variant="h5">Administrator</Typography>
          <TextField name="adminFullName" label="Full name" required fullWidth />
          <TextField name="adminEmail" type="email" label="Email" required fullWidth />

          <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
            <SubmitButton>Create clinic</SubmitButton>
            <Button component={Link} href="/clinics" variant="text">
              Cancel
            </Button>
          </Stack>
        </Stack>
      </form>
    </Paper>
  );
}
