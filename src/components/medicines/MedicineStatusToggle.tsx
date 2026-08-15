"use client";

import Button from "@mui/material/Button";
import { useTransition } from "react";

import { setMedicineActive } from "@/features/medicines/actions";

/** Deactivate / reactivate. Never deletes — past prescriptions reference this row. */
export function MedicineStatusToggle({
  medicineId,
  isActive,
}: {
  medicineId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="small"
      variant="outlined"
      color={isActive ? "error" : "success"}
      disabled={isPending}
      onClick={() => startTransition(() => setMedicineActive(medicineId, !isActive))}
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
