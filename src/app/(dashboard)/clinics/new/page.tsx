import Typography from "@mui/material/Typography";

import { requireRole } from "@/lib/auth/session";

import { NewClinicForm } from "./NewClinicForm";

export default async function NewClinicPage() {
  await requireRole(["SUPER_ADMIN"]);

  return (
    <>
      <Typography variant="h1" component="h1" gutterBottom>
        New clinic
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Creating a clinic also provisions its administrator and a placeholder configuration.
      </Typography>
      <NewClinicForm />
    </>
  );
}
