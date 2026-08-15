"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import { login, type AuthFormState } from "@/features/auth/actions";

const INITIAL_STATE: AuthFormState = { error: null };

/**
 * Shared login for every role. There is exactly one login page — the role is
 * resolved from the profile after authentication, never chosen by the user.
 */
export default function LoginPage() {
  const [state, formAction] = useActionState(login, INITIAL_STATE);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper elevation={1} sx={{ p: { xs: 3, sm: 4 }, width: "100%", maxWidth: 420 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Medi-Track
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sign in to continue
        </Typography>

        <form action={formAction} noValidate>
          <Stack spacing={2}>
            {state.error ? <Alert severity="error">{state.error}</Alert> : null}

            <TextField
              name="email"
              type="email"
              label="Email"
              variant="outlined"
              autoComplete="email"
              required
              fullWidth
              autoFocus
            />

            <TextField
              name="password"
              type="password"
              label="Password"
              variant="outlined"
              autoComplete="current-password"
              required
              fullWidth
            />

            <SubmitButton fullWidth>Sign in</SubmitButton>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
