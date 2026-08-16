"use client";

import Button from "@mui/material/Button";
import { useTransition } from "react";

import { setBillingServiceActive } from "@/features/billing-services/actions";

/** Deactivate / reactivate. Never deletes — past invoices reference this row. */
export function BillingServiceStatusToggle({
  serviceId,
  isActive,
}: {
  serviceId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="small"
      variant="outlined"
      color={isActive ? "error" : "success"}
      disabled={isPending}
      onClick={() => startTransition(() => setBillingServiceActive(serviceId, !isActive))}
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
