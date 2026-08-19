"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import {
  saveConsultationNotes,
  type ConsultationNotesFormState,
} from "@/features/consultation-notes/actions";
import type { ConsultationNote, ConsultationNoteType } from "@/types/clinical";

const INITIAL_STATE: ConsultationNotesFormState = { error: null, success: false };

interface Row {
  key: string;
  /** Empty for a row that has not been saved yet. */
  id: string;
  noteTypeId: string;
  content: string;
  showOnReceipt: boolean;
}

function emptyRow(): Row {
  return { key: crypto.randomUUID(), id: "", noteTypeId: "", content: "", showOnReceipt: false };
}

function rowsFrom(notes: ConsultationNote[]): Row[] {
  if (notes.length === 0) return [emptyRow()];

  return notes.map((note) => ({
    key: note.id,
    id: note.id,
    noteTypeId: note.note_type_id ?? "",
    content: note.content,
    showOnReceipt: note.show_on_receipt,
  }));
}

/**
 * The consultation's notes: any number of rows, each a field, its text, and
 * whether it prints on the letter.
 *
 * Replaces the five fixed textareas the consultation carried until Phase 4.3.
 * The dropdown is clinic master data, so what a clinic records is its own
 * decision rather than something fixed in this file.
 */
export function ConsultationNotesForm({
  consultationId,
  noteTypes,
  notes,
  readOnly,
}: {
  consultationId: string;
  noteTypes: ConsultationNoteType[];
  notes: ConsultationNote[];
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState(saveConsultationNotes, INITIAL_STATE);

  const [rows, setRows] = useState<Row[]>(() => rowsFrom(notes));

  // A row the doctor just added carries no id until the server gives it one. If
  // the form kept its original state after saving, a second save would post
  // that same empty id again and insert the note twice. Re-seeding from the
  // freshly revalidated notes is what stops it — React's documented way to
  // reset state when a prop changes, chosen over a `key` on the component so
  // the "Notes saved" confirmation survives the update.
  const savedIds = notes.map((note) => note.id).join(",");
  const [renderedIds, setRenderedIds] = useState(savedIds);

  if (savedIds !== renderedIds) {
    setRenderedIds(savedIds);
    setRows(rowsFrom(notes));
  }

  const update = (key: string, changes: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  };

  // A deactivated field stays selectable on the row already using it, so an
  // existing note never loses its label mid-edit.
  const optionsFor = (selectedId: string) =>
    noteTypes.filter((type) => type.is_active || type.id === selectedId);

  const hasActiveTypes = noteTypes.some((type) => type.is_active);

  // Nobody who cannot edit needs to look at an empty form.
  if (readOnly && notes.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h4" component="h2" gutterBottom>
            Consultation notes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No notes recorded for this visit.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" component="h2" gutterBottom>
          Consultation notes
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add a field, write against it, and tick it to print on the consultation letter.
        </Typography>

        {hasActiveTypes ? null : (
          <Alert severity="info" sx={{ mb: 2 }}>
            No fields in this clinic&apos;s list yet. Add them under{" "}
            <Link href="/note-types">Consultation Fields</Link>.
          </Alert>
        )}

        <form action={formAction} noValidate>
          <input type="hidden" name="consultation_id" value={consultationId} />

          <Stack spacing={2}>
            {state.error ? <Alert severity="error">{state.error}</Alert> : null}
            {state.success ? <Alert severity="success">Notes saved.</Alert> : null}

            <Stack divider={<Divider />} spacing={2}>
              {rows.map((row, index) => (
                <Stack key={row.key} spacing={1.5} sx={{ pt: index === 0 ? 0 : 2 }}>
                  {/*
                    Every field posts on every row, including the checkbox as a
                    hidden "true"/"false". A bare checkbox posts nothing when
                    unchecked, which would shift the server's parallel arrays
                    out of alignment.
                  */}
                  <input type="hidden" name="note_id" value={row.id} />
                  <input
                    type="hidden"
                    name="show_on_receipt"
                    value={row.showOnReceipt ? "true" : "false"}
                  />

                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <TextField
                      select
                      name="note_type_id"
                      label="Field"
                      value={row.noteTypeId}
                      onChange={(event) => update(row.key, { noteTypeId: event.target.value })}
                      disabled={readOnly}
                      fullWidth
                    >
                      <MenuItem value="">
                        <em>Select a field</em>
                      </MenuItem>
                      {optionsFor(row.noteTypeId).map((type) => (
                        <MenuItem key={type.id} value={type.id}>
                          {type.name}
                          {type.is_active ? "" : " (inactive)"}
                        </MenuItem>
                      ))}
                    </TextField>

                    {readOnly || rows.length === 1 ? null : (
                      <IconButton
                        aria-label="Remove note"
                        onClick={() =>
                          setRows((current) => current.filter((r) => r.key !== row.key))
                        }
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Stack>

                  <TextField
                    name="content"
                    label="Details"
                    value={row.content}
                    onChange={(event) => update(row.key, { content: event.target.value })}
                    disabled={readOnly}
                    fullWidth
                    multiline
                    rows={3}
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={row.showOnReceipt}
                        onChange={(event) =>
                          update(row.key, { showOnReceipt: event.target.checked })
                        }
                        disabled={readOnly}
                      />
                    }
                    label="Show on printed letter"
                  />
                </Stack>
              ))}
            </Stack>

            {readOnly ? null : (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ justifyContent: "space-between" }}
              >
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setRows((current) => [...current, emptyRow()])}
                >
                  Add field
                </Button>
                <SubmitButton>Save notes</SubmitButton>
              </Stack>
            )}
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
