"use client";

import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PickablePatient {
  id: string;
  first_name: string;
  last_name: string;
  patient_number: string;
}

/** Chooses who a standalone invoice is for, before the billing lines are entered. */
export function PatientPicker({ patients }: { patients: PickablePatient[] }) {
  const [patientId, setPatientId] = useState("");
  const router = useRouter();

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Who is this bill for?
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }}>
        <TextField
          select
          label="Patient"
          value={patientId}
          onChange={(event) => setPatientId(event.target.value)}
          fullWidth
        >
          <MenuItem value="">
            <em>Select a patient</em>
          </MenuItem>
          {patients.map((patient) => (
            <MenuItem key={patient.id} value={patient.id}>
              {patient.first_name} {patient.last_name} — {patient.patient_number}
            </MenuItem>
          ))}
        </TextField>

        <Button
          variant="contained"
          disabled={!patientId}
          onClick={() => router.push(`/billing/invoices/new?patient=${patientId}`)}
          sx={{ minWidth: { sm: 140 } }}
        >
          Continue
        </Button>
      </Stack>
    </Paper>
  );
}
