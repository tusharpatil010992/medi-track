"use client";

import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import { createNoteType, type NoteTypeFormState } from "@/features/note-types/actions";

const INITIAL_STATE: NoteTypeFormState = { error: null, success: false };

export function NoteTypeForm() {
  const [state, formAction] = useActionState(createNoteType, INITIAL_STATE);

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Add a field
      </Typography>

      <form action={formAction} noValidate>
        <Stack spacing={2}>
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}
          {state.success ? <Alert severity="success">Field added.</Alert> : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField name="name" label="Field name" required fullWidth placeholder="Allergies" />
            <TextField
              name="display_order"
              label="Order"
              type="number"
              defaultValue="0"
              sx={{ width: { sm: 140 } }}
              slotProps={{ htmlInput: { step: "1", min: "0" } }}
              helperText="Lower shows first"
            />
          </Stack>

          <div>
            <SubmitButton>Add field</SubmitButton>
          </div>
        </Stack>
      </form>
    </Paper>
  );
}
