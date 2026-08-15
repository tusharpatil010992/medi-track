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
          Consultation
        </Typography>

        <form action={formAction} noValidate>
          <input type="hidden" name="consultation_id" value={consultation.id} />

          <Stack spacing={2}>
            {state.error ? <Alert severity="error">{state.error}</Alert> : null}
            {state.consultationId ? <Alert severity="success">Saved.</Alert> : null}

            <TextField
              name="chief_complaint"
              label="Chief complaint"
              fullWidth
              multiline
              rows={2}
              disabled={readOnly}
              defaultValue={consultation.chief_complaint ?? ""}
            />
            <TextField
              name="patient_history"
              label="History"
              fullWidth
              multiline
              rows={3}
              disabled={readOnly}
              defaultValue={consultation.patient_history ?? ""}
              helperText="Allergies, existing conditions, current medication, family history"
            />
            <TextField
              name="examination_findings"
              label="Examination findings"
              fullWidth
              multiline
              rows={3}
              disabled={readOnly}
              defaultValue={consultation.examination_findings ?? ""}
            />
            <TextField
              name="diagnosis"
              label="Diagnosis"
              fullWidth
              multiline
              rows={2}
              disabled={readOnly}
              defaultValue={consultation.diagnosis ?? ""}
            />
            <TextField
              name="treatment_plan"
              label="Treatment plan / doctor's note"
              fullWidth
              multiline
              rows={3}
              disabled={readOnly}
              defaultValue={consultation.treatment_plan ?? ""}
            />

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
                <SubmitButton>Save consultation</SubmitButton>
              </div>
            )}
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
