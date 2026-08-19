import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { StatusChip } from "@/components/common/StatusChip";
import { NoteTypeForm } from "@/components/note-types/NoteTypeForm";
import { NoteTypeStatusToggle } from "@/components/note-types/NoteTypeStatusToggle";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ConsultationNoteType } from "@/types/clinical";
import { NOTE_TYPE_MANAGING_ROLES } from "@/types/user";

export default async function NoteTypesPage() {
  const profile = await requireRole(NOTE_TYPE_MANAGING_ROLES);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();
  const { data: noteTypes } = await supabase
    .from("consultation_note_types")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("display_order")
    .order("name")
    .returns<ConsultationNoteType[]>();

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h1" component="h1" gutterBottom>
          Consultation Fields
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The list a doctor chooses from when writing up a visit. Deactivated fields stay readable
          on past consultations but cannot be chosen for new notes.
        </Typography>
      </div>

      <NoteTypeForm />

      {!noteTypes || noteTypes.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No fields yet. Add the first one above.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Field</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Order</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {noteTypes.map((noteType) => (
                <TableRow key={noteType.id} hover>
                  <TableCell>{noteType.name}</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    {noteType.display_order}
                  </TableCell>
                  <TableCell>
                    <StatusChip isActive={noteType.is_active} />
                  </TableCell>
                  <TableCell align="right">
                    <NoteTypeStatusToggle noteTypeId={noteType.id} isActive={noteType.is_active} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
