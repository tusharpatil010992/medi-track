"use client";

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useRouter } from "next/navigation";

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function DayPicker({ selectedDate }: { selectedDate: string }) {
  const router = useRouter();
  const go = (date: string) => router.replace(`/appointments?date=${date}`);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <IconButton aria-label="Previous day" onClick={() => go(shiftDate(selectedDate, -1))}>
          <ChevronLeftIcon />
        </IconButton>

        <TextField
          type="date"
          label="Date"
          value={selectedDate}
          onChange={(event) => go(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 180 }}
        />

        <IconButton aria-label="Next day" onClick={() => go(shiftDate(selectedDate, 1))}>
          <ChevronRightIcon />
        </IconButton>

        <Button variant="text" onClick={() => go(new Date().toISOString().slice(0, 10))}>
          Today
        </Button>
      </Stack>
    </Paper>
  );
}
