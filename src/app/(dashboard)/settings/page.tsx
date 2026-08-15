import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isPlaceholder, type ClinicConfig } from "@/types/clinic";

import { ClinicConfigForm } from "./ClinicConfigForm";

export default async function SettingsPage() {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();
  const { data: config } = await supabase
    .from("clinic_config")
    .select("*")
    .eq("clinic_id", clinicId)
    .single<ClinicConfig>();

  if (!config) {
    return (
      <>
        <Typography variant="h1" component="h1" gutterBottom>
          Clinic settings
        </Typography>
        <Alert severity="error">
          No configuration found for this clinic. Contact your platform administrator.
        </Alert>
      </>
    );
  }

  // Secret values are deliberately not sent to the browser. The form receives
  // only whether each credential is still a placeholder.
  const status = {
    resend_api_key: isPlaceholder(config.resend_api_key),
    resend_sender_email: isPlaceholder(config.resend_sender_email),
    whatsapp_api_url: isPlaceholder(config.whatsapp_api_url),
    whatsapp_access_token: isPlaceholder(config.whatsapp_access_token),
    whatsapp_phone_number_id: isPlaceholder(config.whatsapp_phone_number_id),
    whatsapp_business_account_id: isPlaceholder(config.whatsapp_business_account_id),
  };

  const hasPlaceholders = Object.values(status).some(Boolean);

  return (
    <>
      <Typography variant="h1" component="h1" gutterBottom>
        Clinic settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Email and WhatsApp credentials for this clinic. Notifications stay disabled until real
        values replace the placeholders.
      </Typography>

      {hasPlaceholders ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Some credentials are still placeholders.
        </Alert>
      ) : null}

      <ClinicConfigForm status={status} timezone={config.timezone} />
    </>
  );
}
