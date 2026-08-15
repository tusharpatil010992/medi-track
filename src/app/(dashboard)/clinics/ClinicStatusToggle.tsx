"use client";

import Button from "@mui/material/Button";
import { useTransition } from "react";

import { setClinicActive } from "@/features/clinics/actions";

/** Activate / deactivate a clinic. Never deletes — history must survive. */
export function ClinicStatusToggle({
  clinicId,
  isActive,
}: {
  clinicId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="small"
      variant="outlined"
      color={isActive ? "error" : "success"}
      disabled={isPending}
      onClick={() => startTransition(() => setClinicActive(clinicId, !isActive))}
    >
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
