import Typography from "@mui/material/Typography";

import { requireRole } from "@/lib/auth/session";

import { NewUserForm } from "./NewUserForm";

export default async function NewUserPage() {
  await requireRole(["ADMIN"]);

  return (
    <>
      <Typography variant="h1" component="h1" gutterBottom>
        New user
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The account is created inside your clinic. There is no clinic selector — membership follows
        your own account.
      </Typography>
      <NewUserForm />
    </>
  );
}
