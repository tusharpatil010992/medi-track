import Chip from "@mui/material/Chip";

import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/types/billing";

/** Colour reinforces the label; it never carries the meaning on its own. */
const STATUS_COLOUR: Record<InvoiceStatus, "default" | "info" | "warning" | "success" | "error"> = {
  DRAFT: "default",
  ISSUED: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  CANCELLED: "error",
  VOID: "error",
};

export function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  return (
    <Chip
      size="small"
      label={INVOICE_STATUS_LABELS[status]}
      color={STATUS_COLOUR[status]}
      variant={status === "DRAFT" ? "outlined" : "filled"}
    />
  );
}
