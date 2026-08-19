"use client";

import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import {
  updateConsultation,
  type ConsultationFormState,
} from "@/features/consultations/actions";
import type { Consultation } from "@/types/clinical";

const INITIAL_STATE: ConsultationFormState = { error: null, consultationId: null };

/**
 * The consultation's follow-up arrangements.
 *
 * The five clinical textareas that used to live here — chief complaint,
 * history, examination findings, diagnosis and treatment plan — moved to
 * ConsultationNotesForm in Phase 4.3, where a clinic decides its own fields.
 */
export function ConsultationDetailsForm({
  consultation,
  readOnly,
}: {
  consultation: Consultation;
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState(updateConsultation, INITIAL_STATE);

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" component="h2" gutterBottom>
          Follow-up
        </Typography>

        <form action={formAction} noValidate>
          <input type="hidden" name="consultation_id" value={consultation.id} />

          <Stack spacing={2}>
            {state.error ? <Alert severity="error">{state.error}</Alert> : null}
            {state.consultationId ? <Alert severity="success">Saved.</Alert> : null}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                name="follow_up_date"
                type="date"
                label="Follow-up date"
                fullWidth
                disabled={readOnly}
                slotProps={{ inputLabel: { shrink: true } }}
                defaultValue={consultation.follow_up_date ?? ""}
              />
              <TextField
                name="follow_up_notes"
                label="Follow-up notes"
                fullWidth
                disabled={readOnly}
                defaultValue={consultation.follow_up_notes ?? ""}
              />
            </Stack>

            {readOnly ? null : (
              <div>
                <SubmitButton>Save follow-up</SubmitButton>
              </div>
            )}
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
