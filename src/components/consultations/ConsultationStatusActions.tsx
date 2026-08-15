"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useTransition } from "react";

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

  if (!isConsultationEditable(status)) return null;

  return (
    <Stack direction="row" spacing={1}>
      <Button
        variant="contained"
        color="success"
        disabled={isPending}
        onClick={() => startTransition(() => setConsultationStatus(consultationId, "COMPLETED"))}
      >
        Complete
      </Button>
      <Button
        variant="outlined"
        color="error"
        disabled={isPending}
        onClick={() => startTransition(() => setConsultationStatus(consultationId, "CANCELLED"))}
      >
        Cancel
      </Button>
    </Stack>
  );
}
