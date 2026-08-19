import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

/** One note from an earlier visit, already resolved to that visit's date. */
export interface PriorNote {
  id: string;
  consultation_id: string;
  consultation_date: string;
  note_type_snapshot: string;
  content: string;
}

interface Visit {
  consultationId: string;
  date: string;
  notes: PriorNote[];
}

/** Groups notes by the visit they were written at, preserving the given order. */
function groupByVisit(notes: PriorNote[]): Visit[] {
  const visits: Visit[] = [];

  for (const note of notes) {
    const current = visits.at(-1);
    if (current && current.consultationId === note.consultation_id) {
      current.notes.push(note);
      continue;
    }
    visits.push({
      consultationId: note.consultation_id,
      date: note.consultation_date,
      notes: [note],
    });
  }

  return visits;
}

/**
 * Notes recorded at this patient's earlier visits, newest first.
 *
 * Read-only. The two most recent visits are expanded; older ones stay collapsed
 * so the consultation page does not become a wall of text.
 */
export function PreviousHistory({ notes }: { notes: PriorNote[] }) {
  // Nothing to show means no empty box — the section disappears entirely.
  if (notes.length === 0) return null;

  const visits = groupByVisit(notes);

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" component="h2" gutterBottom>
          Notes from earlier visits
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Recorded at previous consultations. Read-only here.
        </Typography>

        {visits.map((visit, index) => (
          <Accordion key={visit.consultationId} defaultExpanded={index < 2} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" component="h3">
                {visit.date}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1.5}>
                {visit.notes.map((note) => (
                  <div key={note.id}>
                    <Typography variant="subtitle2" component="h4">
                      {note.note_type_snapshot}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {note.content}
                    </Typography>
                  </div>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </CardContent>
    </Card>
  );
}
