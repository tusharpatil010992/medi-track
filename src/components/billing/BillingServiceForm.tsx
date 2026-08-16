"use client";

import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import {
  createBillingService,
  type BillingServiceFormState,
} from "@/features/billing-services/actions";

const INITIAL_STATE: BillingServiceFormState = { error: null, success: false };

export function BillingServiceForm() {
  const [state, formAction] = useActionState(createBillingService, INITIAL_STATE);

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Add a service
      </Typography>

      <form action={formAction} noValidate>
        <Stack spacing={2}>
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}
          {state.success ? <Alert severity="success">Service added.</Alert> : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField name="name" label="Service name" required fullWidth placeholder="Consultation" />
            <TextField
              name="price"
              label="Price"
              type="number"
              required
              slotProps={{ htmlInput: { step: "0.01", min: "0" } }}
              sx={{ minWidth: { sm: 180 } }}
            />
          </Stack>

          <TextField name="description" label="Description" fullWidth />

          <div>
            <SubmitButton>Add service</SubmitButton>
          </div>
        </Stack>
      </form>
    </Paper>
  );
}
