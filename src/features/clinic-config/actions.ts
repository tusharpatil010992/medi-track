"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface ClinicConfigState {
  error: string | null;
  success: boolean;
}

/** Fields the ADMIN may update. Anything not listed here is not writable from the UI. */
const EDITABLE_FIELDS = [
  "resend_api_key",
  "resend_sender_email",
  "whatsapp_api_url",
  "whatsapp_access_token",
  "whatsapp_phone_number_id",
  "whatsapp_business_account_id",
  "timezone",
] as const;

/**
 * Updates the acting ADMIN's own clinic configuration.
 *
 * Blank fields are skipped, so an untouched secret keeps its stored value and
 * never has to be round-tripped through the browser to survive a save.
 */
export async function updateClinicConfig(
  _prevState: ClinicConfigState,
  formData: FormData,
): Promise<ClinicConfigState> {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const updates: Record<string, string> = {};

  for (const field of EDITABLE_FIELDS) {
    const value = String(formData.get(field) ?? "").trim();
    if (value) updates[field] = value;
  }

  if (Object.keys(updates).length === 0) {
    return { error: "Nothing to update — fill in at least one field.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_config")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("clinic_id", clinicId);

  if (error) {
    return { error: `Could not save configuration: ${error.message}`, success: false };
  }

  revalidatePath("/settings");

  return { error: null, success: true };
}
