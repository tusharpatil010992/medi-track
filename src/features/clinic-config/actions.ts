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

/**
 * Updates print settings for the acting ADMIN's own clinic.
 *
 * These live on `clinics` rather than `clinic_config` because DOCTORs print the
 * letters and cannot read `clinic_config`, which is restricted to ADMIN as it
 * stores live credentials.
 */
export async function updatePrintSettings(
  _prevState: ClinicConfigState,
  formData: FormData,
): Promise<ClinicConfigState> {
  const profile = await requireRole(["ADMIN"]);
  const clinicId = requireClinicId(profile);

  const raw = String(formData.get("letterhead_gap_percent") ?? "").trim();
  if (!raw) return { error: "Enter a letterhead gap.", success: false };

  const percent = Number(raw);
  if (!Number.isFinite(percent)) return { error: "Letterhead gap must be a number.", success: false };
  if (percent < 0 || percent > 50) {
    return { error: "Letterhead gap must be between 0 and 50 percent.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinics")
    .update({
      letterhead_gap_percent: percent,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", clinicId);

  if (error) {
    return { error: `Could not save print settings: ${error.message}`, success: false };
  }

  revalidatePath("/settings");

  return { error: null, success: true };
}
