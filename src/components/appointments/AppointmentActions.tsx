"use client";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { useState, useTransition } from "react";

import { setAppointmentStatus } from "@/features/appointments/actions";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/types/appointment";

/**
 * Status transitions offered from the day view.
 *
 * Terminal statuses map to an empty list, so a completed or cancelled
 * appointment offers no actions. The server re-checks this independently.
 */
const NEXT_STATUSES: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  RESCHEDULED: [],
};

export function AppointmentActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatus;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const options = NEXT_STATUSES[status];
  if (options.length === 0) return null;

  return (
    <>
      <IconButton
        aria-label="Appointment actions"
        disabled={isPending}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        <MoreVertIcon />
      </IconButton>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {options.map((next) => (
          <MenuItem
            key={next}
            onClick={() => {
              setAnchorEl(null);
              startTransition(async () => {
                const result = await setAppointmentStatus(appointmentId, next);
                setError(result.error);
              });
            }}
          >
            Mark {APPOINTMENT_STATUS_LABELS[next].toLowerCase()}
          </MenuItem>
        ))}
      </Menu>

      {/* A refused transition is usually the billing gate on completing a visit. */}
      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="warning" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
