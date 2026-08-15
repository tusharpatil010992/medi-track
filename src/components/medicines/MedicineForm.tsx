"use client";

import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import { createMedicine, type MedicineFormState } from "@/features/medicines/actions";

const INITIAL_STATE: MedicineFormState = { error: null, success: false };

export function MedicineForm() {
  const [state, formAction] = useActionState(createMedicine, INITIAL_STATE);

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Add a medicine
      </Typography>

      <form action={formAction} noValidate>
        <Stack spacing={2}>
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}
          {state.success ? <Alert severity="success">Medicine added.</Alert> : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField name="name" label="Name" required fullWidth />
            <TextField name="generic_name" label="Generic name" fullWidth />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField name="strength" label="Strength" fullWidth placeholder="500" />
            <TextField name="unit" label="Unit" fullWidth placeholder="mg" />
            <TextField name="dosage_form" label="Form" fullWidth placeholder="Tablet" />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField name="manufacturer" label="Manufacturer" fullWidth />
            <TextField
              name="cost_price"
              label="Cost price"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { step: "0.01", min: "0" } }}
            />
            <TextField
              name="selling_price"
              label="Selling price"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { step: "0.01", min: "0" } }}
            />
          </Stack>

          <div>
            <SubmitButton>Add medicine</SubmitButton>
          </div>
        </Stack>
      </form>
    </Paper>
  );
}
