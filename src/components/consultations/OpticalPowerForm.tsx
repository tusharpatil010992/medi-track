"use client";

import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import {
  saveOpticalPower,
  type OpticalPowerFormState,
} from "@/features/optical-power/actions";
import type { OpticalPower } from "@/types/clinical";

const INITIAL_STATE: OpticalPowerFormState = { error: null, success: false };

/** SPH/CYL/ADD accept quarter-dioptre steps; AXIS is whole degrees 0–180. */
function PowerCell({
  name,
  defaultValue,
  readOnly,
  axis = false,
}: {
  name: string;
  defaultValue: number | null;
  readOnly: boolean;
  axis?: boolean;
}) {
  return (
    <TableCell sx={{ minWidth: 96 }}>
      <TextField
        name={name}
        type="number"
        size="small"
        fullWidth
        disabled={readOnly}
        defaultValue={defaultValue ?? ""}
        slotProps={{
          htmlInput: axis
            ? { step: 1, min: 0, max: 180, "aria-label": name.replaceAll("_", " ") }
            : { step: 0.25, "aria-label": name.replaceAll("_", " ") },
        }}
      />
    </TableCell>
  );
}

export function OpticalPowerForm({
  consultationId,
  optical,
  readOnly,
}: {
  consultationId: string;
  optical: OpticalPower | null;
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState(saveOpticalPower, INITIAL_STATE);

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" component="h2" gutterBottom>
          Optical power
        </Typography>

        <form action={formAction} noValidate>
          <input type="hidden" name="consultation_id" value={consultationId} />

          <Stack spacing={2}>
            {state.error ? <Alert severity="error">{state.error}</Alert> : null}
            {state.success ? <Alert severity="success">Optical power saved.</Alert> : null}

            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Eye</TableCell>
                    <TableCell>SPH</TableCell>
                    <TableCell>CYL</TableCell>
                    <TableCell>AXIS</TableCell>
                    <TableCell>ADD</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Right</TableCell>
                    <PowerCell
                      name="right_eye_sph"
                      defaultValue={optical?.right_eye_sph ?? null}
                      readOnly={readOnly}
                    />
                    <PowerCell
                      name="right_eye_cyl"
                      defaultValue={optical?.right_eye_cyl ?? null}
                      readOnly={readOnly}
                    />
                    <PowerCell
                      name="right_eye_axis"
                      defaultValue={optical?.right_eye_axis ?? null}
                      readOnly={readOnly}
                      axis
                    />
                    <PowerCell
                      name="right_eye_add"
                      defaultValue={optical?.right_eye_add ?? null}
                      readOnly={readOnly}
                    />
                  </TableRow>
                  <TableRow>
                    <TableCell>Left</TableCell>
                    <PowerCell
                      name="left_eye_sph"
                      defaultValue={optical?.left_eye_sph ?? null}
                      readOnly={readOnly}
                    />
                    <PowerCell
                      name="left_eye_cyl"
                      defaultValue={optical?.left_eye_cyl ?? null}
                      readOnly={readOnly}
                    />
                    <PowerCell
                      name="left_eye_axis"
                      defaultValue={optical?.left_eye_axis ?? null}
                      readOnly={readOnly}
                      axis
                    />
                    <PowerCell
                      name="left_eye_add"
                      defaultValue={optical?.left_eye_add ?? null}
                      readOnly={readOnly}
                    />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                name="pupil_distance"
                label="Pupil distance (mm)"
                type="number"
                disabled={readOnly}
                defaultValue={optical?.pupil_distance ?? ""}
                slotProps={{ htmlInput: { step: 0.5 } }}
                sx={{ maxWidth: 200 }}
              />
              <TextField
                name="notes"
                label="Notes"
                fullWidth
                disabled={readOnly}
                defaultValue={optical?.notes ?? ""}
              />
            </Stack>

            {readOnly ? null : (
              <div>
                <SubmitButton>Save optical power</SubmitButton>
              </div>
            )}
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
