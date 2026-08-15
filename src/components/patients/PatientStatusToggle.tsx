"use client";

import Button from "@mui/material/Button";
import { useTransition } from "react";

import { setPatientActive } from "@/features/patients/actions";

/** Deactivate / reactivate a patient. Never deletes — history must survive. */
export function PatientStatusToggle({
  patientId,
  isActive,
}: {
  patientId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outlined"
      color={isActive ? "error" : "success"}
      disabled={isPending}
      onClick={() => startTransition(() => setPatientActive(patientId, !isActive))}
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
