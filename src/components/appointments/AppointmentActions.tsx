"use client";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
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
              startTransition(() => setAppointmentStatus(appointmentId, next));
            }}
          >
            Mark {APPOINTMENT_STATUS_LABELS[next].toLowerCase()}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
