"use client";

import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import { changePassword, type PasswordFormState } from "@/features/profile/actions";

const INITIAL_STATE: PasswordFormState = { error: null, success: false };

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePassword, INITIAL_STATE);

  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
      <Typography variant="h5" gutterBottom>
        Change password
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        You need your current password to set a new one.
      </Typography>

      <form action={formAction} noValidate>
        <Stack spacing={2}>
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}
          {state.success ? <Alert severity="success">Password updated.</Alert> : null}

          <TextField
            name="current_password"
            type="password"
            label="Current password"
            autoComplete="current-password"
            required
            fullWidth
          />
          <TextField
            name="new_password"
            type="password"
            label="New password"
            autoComplete="new-password"
            required
            fullWidth
            helperText="At least 8 characters"
          />
          <TextField
            name="confirm_password"
            type="password"
            label="Confirm new password"
            autoComplete="new-password"
            required
            fullWidth
          />

          <div>
            <SubmitButton>Update password</SubmitButton>
          </div>
        </Stack>
      </form>
    </Paper>
  );
}
