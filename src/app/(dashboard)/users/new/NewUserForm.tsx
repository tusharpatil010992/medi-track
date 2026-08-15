"use client";

import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import { createClinicUser, type CreateUserState } from "@/features/users/actions";
import { CLINIC_STAFF_ROLES, ROLE_LABELS, type ClinicStaffRole } from "@/types/user";

const INITIAL_STATE: CreateUserState = { error: null, provisioned: null };

export function NewUserForm() {
  const [state, formAction] = useActionState(createClinicUser, INITIAL_STATE);
  const [role, setRole] = useState<ClinicStaffRole>("DOCTOR");

  const isClinician = role === "DOCTOR" || role === "OPTOMETRIST";

  if (state.provisioned) {
    const { fullName, email, temporaryPassword } = state.provisioned;

    return (
      <Stack spacing={3} sx={{ maxWidth: 640 }}>
        <Alert severity="success">
          <AlertTitle>{fullName} added</AlertTitle>
          The account is active and scoped to your clinic.
        </Alert>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Temporary credentials
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Shown once. Pass these to the user, who signs in at the shared login page.
          </Typography>
          <Typography variant="body2">
            <strong>Email:</strong> {email}
          </Typography>
          <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
            <strong>Password:</strong> {temporaryPassword}
          </Typography>
        </Paper>

        <Box>
          <Button component={Link} href="/users" variant="contained">
            Back to users
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

          <TextField name="fullName" label="Full name" required fullWidth />
          <TextField name="email" type="email" label="Email" required fullWidth />
          <TextField name="phone" label="Phone" fullWidth />

          <FormControl fullWidth>
            <InputLabel id="role-label">Role</InputLabel>
            <Select
              labelId="role-label"
              name="role"
              label="Role"
              value={role}
              onChange={(event) => setRole(event.target.value as ClinicStaffRole)}
            >
              {CLINIC_STAFF_ROLES.map((staffRole) => (
                <MenuItem key={staffRole} value={staffRole}>
                  {ROLE_LABELS[staffRole]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {isClinician ? (
            <>
              <TextField name="specialty" label="Specialty" fullWidth />
              <TextField name="licenseNumber" label="License number" fullWidth />
            </>
          ) : null}

          <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
            <SubmitButton>Create user</SubmitButton>
            <Button component={Link} href="/users" variant="text">
              Cancel
            </Button>
          </Stack>
        </Stack>
      </form>
    </Paper>
  );
}
