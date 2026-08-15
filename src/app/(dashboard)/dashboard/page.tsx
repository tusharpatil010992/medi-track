import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { requireProfile } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/types/user";

export default async function DashboardPage() {
  const profile = await requireProfile();

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h1" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Signed in as {profile.full_name} ({ROLE_LABELS[profile.role]})
        </Typography>
      </div>

      <Card>
        <CardContent>
          <Typography variant="h4" component="h2" gutterBottom>
            Phase 1 — Foundation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Authentication, multi-tenancy and clinic user management are in place. Patients,
            appointments, consultations and billing arrive in later phases.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
