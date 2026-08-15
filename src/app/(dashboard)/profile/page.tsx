import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/types/user";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}

/** Available to every signed-in role — no requireRole gate. */
export default async function ProfilePage() {
  const profile = await requireProfile();

  let clinicName = "Platform Administration";

  if (profile.clinic_id) {
    const supabase = await createClient();
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", profile.clinic_id)
      .maybeSingle<{ name: string }>();

    clinicName = clinic?.name ?? "Clinic";
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h1" component="h1">
        My profile
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
        <Typography variant="h5" gutterBottom>
          Account
        </Typography>
        <Field label="Name" value={profile.full_name} />
        <Field label="Email" value={profile.email} />
        <Field label="Role" value={ROLE_LABELS[profile.role]} />
        <Field label="Clinic" value={clinicName} />
        {profile.specialty ? <Field label="Specialty" value={profile.specialty} /> : null}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
          Your administrator maintains these details.
        </Typography>
      </Paper>

      <ChangePasswordForm />
    </Stack>
  );
}
