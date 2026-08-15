"use client";

import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import { updateClinicConfig, type ClinicConfigState } from "@/features/clinic-config/actions";

const INITIAL_STATE: ClinicConfigState = { error: null, success: false };

type FieldKey =
  | "resend_api_key"
  | "resend_sender_email"
  | "whatsapp_api_url"
  | "whatsapp_phone_number_id"
  | "whatsapp_business_account_id"
  | "whatsapp_access_token";

interface ClinicConfigFormProps {
  /** true when the stored value is still a placeholder. */
  status: Record<FieldKey, boolean>;
  timezone: string;
}

const FIELDS: { key: FieldKey; label: string; secret: boolean }[] = [
  { key: "resend_api_key", label: "Resend API key", secret: true },
  { key: "resend_sender_email", label: "Resend sender email", secret: false },
  { key: "whatsapp_api_url", label: "WhatsApp API URL", secret: false },
  { key: "whatsapp_access_token", label: "WhatsApp access token", secret: true },
  { key: "whatsapp_phone_number_id", label: "WhatsApp phone number ID", secret: false },
  { key: "whatsapp_business_account_id", label: "WhatsApp business account ID", secret: false },
];

export function ClinicConfigForm({ status, timezone }: ClinicConfigFormProps) {
  const [state, formAction] = useActionState(updateClinicConfig, INITIAL_STATE);

  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 640 }}>
      <form action={formAction} noValidate>
        <Stack spacing={2}>
          {state.error ? <Alert severity="error">{state.error}</Alert> : null}
          {state.success ? <Alert severity="success">Configuration saved.</Alert> : null}

          <Typography variant="body2" color="text.secondary">
            Leave a field blank to keep its current value. Stored credentials are never sent back
            to the browser.
          </Typography>

          {FIELDS.map((field) => (
            <TextField
              key={field.key}
              name={field.key}
              label={field.label}
              type={field.secret ? "password" : "text"}
              autoComplete="off"
              fullWidth
              placeholder={status[field.key] ? "Not configured" : "Configured — leave blank to keep"}
              helperText={status[field.key] ? "Currently a placeholder" : "A value is stored"}
            />
          ))}

          <Divider sx={{ my: 1 }} />

          <TextField
            name="timezone"
            label="Timezone"
            defaultValue={timezone}
            fullWidth
            helperText="IANA name, for example Asia/Kolkata"
          />

          <div>
            <SubmitButton>Save configuration</SubmitButton>
          </div>
        </Stack>
      </form>
    </Paper>
  );
}
