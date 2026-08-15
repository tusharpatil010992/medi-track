import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";

export interface PriorHistoryEntry {
  id: string;
  consultation_date: string;
  patient_history: string | null;
}

/**
 * History recorded at this patient's earlier visits, newest first.
 *
 * Read-only. The two most recent are expanded; older ones stay collapsed so the
 * consultation page does not become a wall of text.
 */
export function PreviousHistory({ entries }: { entries: PriorHistoryEntry[] }) {
  // Nothing to show means no empty box — the section disappears entirely.
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" component="h2" gutterBottom>
          History from earlier visits
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Recorded at previous consultations. Read-only here.
        </Typography>

        {entries.map((entry, index) => (
          <Accordion key={entry.id} defaultExpanded={index < 2} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" component="h3">
                {entry.consultation_date}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {entry.patient_history}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </CardContent>
    </Card>
  );
}
