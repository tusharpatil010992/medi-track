"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import {
  savePrescription,
  type PrescriptionFormState,
} from "@/features/prescriptions/actions";
import type { Medicine, Prescription, PrescriptionItem } from "@/types/clinical";

const INITIAL_STATE: PrescriptionFormState = { error: null, success: false };

interface Row {
  key: string;
  medicineId: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
}

function emptyRow(): Row {
  return {
    key: crypto.randomUUID(),
    medicineId: "",
    dosage: "",
    frequency: "",
    duration: "",
    quantity: "",
    instructions: "",
  };
}

export function PrescriptionForm({
  consultationId,
  medicines,
  prescription,
  items,
  readOnly,
}: {
  consultationId: string;
  medicines: Medicine[];
  prescription: Prescription | null;
  items: PrescriptionItem[];
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState(savePrescription, INITIAL_STATE);

  const [rows, setRows] = useState<Row[]>(() =>
    items.length > 0
      ? items.map((item) => ({
          key: item.id,
          medicineId: item.medicine_id ?? "",
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration ?? "",
          quantity: item.quantity === null ? "" : String(item.quantity),
          instructions: item.instructions ?? "",
        }))
      : [emptyRow()],
  );

  const update = (key: string, field: keyof Omit<Row, "key">, value: string) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" component="h2" gutterBottom>
          Prescription
        </Typography>

        {medicines.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            No active medicines in this clinic. An administrator adds them under Medicines.
          </Alert>
        ) : null}

        <form action={formAction} noValidate>
          <input type="hidden" name="consultation_id" value={consultationId} />

          <Stack spacing={2}>
            {state.error ? <Alert severity="error">{state.error}</Alert> : null}
            {state.success ? <Alert severity="success">Prescription saved.</Alert> : null}

            <Stack divider={<Divider />} spacing={2}>
              {rows.map((row, index) => (
                <Stack key={row.key} spacing={1.5} sx={{ pt: index === 0 ? 0 : 2 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <TextField
                      select
                      label="Medicine"
                      value={row.medicineId}
                      onChange={(event) => update(row.key, "medicineId", event.target.value)}
                      disabled={readOnly}
                      fullWidth
                      name="medicine_id"
                    >
                      <MenuItem value="">
                        <em>Select a medicine</em>
                      </MenuItem>
                      {medicines.map((medicine) => (
                        <MenuItem key={medicine.id} value={medicine.id}>
                          {medicine.name}
                          {medicine.strength ? ` ${medicine.strength}${medicine.unit ?? ""}` : ""}
                        </MenuItem>
                      ))}
                    </TextField>

                    {readOnly || rows.length === 1 ? null : (
                      <IconButton
                        aria-label="Remove medicine"
                        onClick={() =>
                          setRows((current) => current.filter((r) => r.key !== row.key))
                        }
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Stack>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField
                      name="dosage"
                      label="Dosage"
                      value={row.dosage}
                      onChange={(event) => update(row.key, "dosage", event.target.value)}
                      disabled={readOnly}
                      fullWidth
                      placeholder="1 tablet"
                    />
                    <TextField
                      name="frequency"
                      label="Frequency"
                      value={row.frequency}
                      onChange={(event) => update(row.key, "frequency", event.target.value)}
                      disabled={readOnly}
                      fullWidth
                      placeholder="Twice daily"
                    />
                    <TextField
                      name="duration"
                      label="Duration"
                      value={row.duration}
                      onChange={(event) => update(row.key, "duration", event.target.value)}
                      disabled={readOnly}
                      fullWidth
                      placeholder="5 days"
                    />
                    <TextField
                      name="quantity"
                      label="Qty"
                      type="number"
                      value={row.quantity}
                      onChange={(event) => update(row.key, "quantity", event.target.value)}
                      disabled={readOnly}
                      sx={{ maxWidth: { sm: 100 } }}
                    />
                  </Stack>

                  <TextField
                    name="instructions"
                    label="Instructions"
                    value={row.instructions}
                    onChange={(event) => update(row.key, "instructions", event.target.value)}
                    disabled={readOnly}
                    fullWidth
                    placeholder="After food"
                  />
                </Stack>
              ))}
            </Stack>

            {readOnly ? null : (
              <div>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setRows((current) => [...current, emptyRow()])}
                >
                  Add medicine
                </Button>
              </div>
            )}

            <TextField
              name="prescription_notes"
              label="Prescription notes"
              fullWidth
              multiline
              rows={2}
              disabled={readOnly}
              defaultValue={prescription?.notes ?? ""}
            />

            {readOnly ? null : (
              <div>
                <SubmitButton>Save prescription</SubmitButton>
              </div>
            )}
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
