export interface Clinic {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Per-clinic integration credentials.
 *
 * Contains live secrets. RLS restricts reads to the clinic's ADMIN and
 * SUPER_ADMIN; never send this to a client component unredacted.
 */
export interface ClinicConfig {
  id: string;
  clinic_id: string;
  resend_api_key: string;
  resend_sender_email: string;
  whatsapp_api_url: string;
  whatsapp_access_token: string;
  whatsapp_phone_number_id: string;
  whatsapp_business_account_id: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

/** Placeholders written at clinic creation so a clinic is usable before real keys exist. */
export const DUMMY_CONFIG_VALUES = {
  resend_api_key: "dummy_resend_key",
  resend_sender_email: "noreply@dummy.com",
  whatsapp_api_url: "https://api.whatsapp.com/dummy",
  whatsapp_access_token: "dummy_whatsapp_token",
  whatsapp_phone_number_id: "dummy_phone_id",
  whatsapp_business_account_id: "dummy_business_id",
} as const;

/** True when the value is still a placeholder, so notifications must not be attempted. */
export function isPlaceholder(value: string): boolean {
  return value.startsWith("dummy_") || value === DUMMY_CONFIG_VALUES.resend_sender_email;
}
