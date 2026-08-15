"use client";

import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import {
  updatePrintSettings,
  type ClinicConfigState,
} from "@/features/clinic-config/actions";
import { letterheadGapToMm } from "@/types/clinic";

const INITIAL_STATE: ClinicConfigState = { error: null, success: false };

export function PrintSettingsForm({ letterheadGapPercent }: { letterheadGapPercent: number }) {
  const [state, formAction] = useActionState(updatePrintSettings, INITIAL_STATE);
  const [percent, setPercent] = useState(String(letterheadGapPercent));

  const parsed = Number(percent);
  const preview = Number.isFinite(parsed) ? letterheadGapToMm(parsed) : "—";

  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 640 }}>
      <Typography variant="h5" gutterBottom>
        Print settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Printed letters carry no clinic header, so they sit correctly on your own
        letterhead. This reserves blank space at the top of the page for it.
      </Typography>

      <form action={formAction} noValidate>
        <Stack spacing={2}>
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}
          {state.success ? <Alert severity="success">Print settings saved.</Alert> : null}

          <TextField
            name="letterhead_gap_percent"
            label="Letterhead gap"
            type="number"
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            slotProps={{ htmlInput: { step: 0.5, min: 0, max: 50 } }}
            helperText={`Percentage of page height. ${preview} on A4. Set 0 for plain paper.`}
            sx={{ maxWidth: 280 }}
          />

          <div>
            <SubmitButton>Save print settings</SubmitButton>
          </div>
        </Stack>
      </form>
    </Paper>
  );
}
