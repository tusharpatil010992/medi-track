"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useState, useTransition } from "react";

import { setConsultationStatus } from "@/features/consultations/actions";
import { isConsultationEditable, type ConsultationStatus } from "@/types/clinical";

export function ConsultationStatusActions({
  consultationId,
  status,
}: {
  consultationId: string;
  status: ConsultationStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isConsultationEditable(status)) return null;

  const change = (next: ConsultationStatus) => {
    setError(null);
    startTransition(async () => {
      const result = await setConsultationStatus(consultationId, next);
      setError(result.error);
    });
  };

  return (
    <Stack spacing={1} sx={{ alignItems: { sm: "flex-end" } }}>
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          color="success"
          disabled={isPending}
          onClick={() => change("COMPLETED")}
        >
          Complete
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={isPending}
          onClick={() => change("CANCELLED")}
        >
          Cancel
        </Button>
      </Stack>

      {/* Usually the billing gate: the bill must be raised and paid first. */}
      {error ? <Alert severity="warning">{error}</Alert> : null}
    </Stack>
  );
}
