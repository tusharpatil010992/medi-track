"use client";

import DeleteIcon from "@mui/icons-material/Delete";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState, useTransition } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import {
  addAvailability,
  removeAvailability,
  type AvailabilityFormState,
} from "@/features/availability/actions";
import { DAY_NAMES, type DoctorAvailability } from "@/types/appointment";

const INITIAL_STATE: AvailabilityFormState = { error: null, success: false };

function RemoveButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <IconButton
      aria-label="Remove window"
      size="small"
      disabled={isPending}
      onClick={() => startTransition(() => removeAvailability(id))}
    >
      <DeleteIcon fontSize="small" />
    </IconButton>
  );
}

export function ScheduleEditor({ availability }: { availability: DoctorAvailability[] }) {
  const [state, formAction] = useActionState(addAvailability, INITIAL_STATE);

  const byDay = DAY_NAMES.map((name, day) => ({
    name,
    day,
    windows: availability.filter((slot) => slot.day_of_week === day),
  }));

  return (
    <Stack spacing={3} sx={{ maxWidth: 640 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Add a window
        </Typography>

        <form action={formAction} noValidate>
          <Stack spacing={2}>
            {state.error ? <Alert severity="error">{state.error}</Alert> : null}
            {state.success ? <Alert severity="success">Availability added.</Alert> : null}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth required>
                <InputLabel id="day-label">Day</InputLabel>
                <Select labelId="day-label" name="day_of_week" label="Day" defaultValue={1}>
                  {DAY_NAMES.map((name, day) => (
                    <MenuItem key={name} value={day}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                name="start_time"
                type="time"
                label="From"
                required
                fullWidth
                defaultValue="09:00"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                name="end_time"
                type="time"
                label="To"
                required
                fullWidth
                defaultValue="17:00"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>

            <div>
              <SubmitButton>Add window</SubmitButton>
            </div>
          </Stack>
        </form>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Weekly availability
        </Typography>

        <Stack divider={<Divider />}>
          {byDay.map(({ name, windows }) => (
            <Stack
              key={name}
              direction="row"
              spacing={2}
              sx={{ py: 1.5, alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography variant="body2" sx={{ minWidth: 100 }}>
                {name}
              </Typography>

              {windows.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  Not available
                </Typography>
              ) : (
                <Stack sx={{ flex: 1 }}>
                  {windows.map((slot) => (
                    <Stack
                      key={slot.id}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2">
                        {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                      </Typography>
                      <RemoveButton id={slot.id} />
                    </Stack>
                  ))}
                </Stack>
              )}
            </Stack>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
