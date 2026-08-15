import Chip from "@mui/material/Chip";

import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/types/appointment";

/** Colour is paired with a text label, never used alone to convey state. */
const STATUS_COLOR: Record<AppointmentStatus, "default" | "info" | "primary" | "success" | "warning" | "error"> = {
  SCHEDULED: "info",
  CONFIRMED: "primary",
  CHECKED_IN: "warning",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "error",
  NO_SHOW: "error",
  RESCHEDULED: "default",
};

export function AppointmentStatusChip({ status }: { status: AppointmentStatus }) {
  return (
    <Chip size="small" label={APPOINTMENT_STATUS_LABELS[status]} color={STATUS_COLOR[status]} />
  );
}
