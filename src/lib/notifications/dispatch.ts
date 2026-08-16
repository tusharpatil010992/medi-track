import { createAdminClient } from "@/lib/supabase/admin";
import { isPlaceholder, type Clinic, type ClinicConfig } from "@/types/clinic";
import type { DeliveryStatus, NotificationChannel } from "@/types/notification";
import { patientDisplayName, type Patient } from "@/types/patient";

import { sendEmail, sendWhatsApp, type SendResult } from "./providers";
import { renderNotification, type NotificationEvent } from "./templates";

/**
 * Centralised outbound notification service. Server-only.
 *
 * Two things about this module are deliberate and worth knowing:
 *
 * 1. It reads clinic_config with the SERVICE-ROLE client, bypassing RLS.
 *    clinic_config is ADMIN-readable only because it holds live credentials,
 *    but the people who trigger notifications are FRONT_DESK booking an
 *    appointment and DOCTOR taking a payment — neither can read it. The clinic
 *    scope that RLS would have applied is therefore applied here by hand:
 *    every query below filters on the clinic_id passed in, which itself came
 *    from the caller's authenticated profile and never from a request body.
 *
 * 2. It never throws. A dead provider, an expired key or a slow network must
 *    not roll back the booking, consultation or payment that triggered it. Any
 *    failure is recorded against the notification row and execution continues.
 */

interface NotifyInput {
  /** Always from the acting user's server-side profile. Never from the client. */
  clinicId: string;
  patientId: string;
  event: NotificationEvent;
  relatedEntityType: string;
  relatedEntityId: string;
}

type AdminClient = ReturnType<typeof createAdminClient>;

interface LogInput {
  clinicId: string;
  channel: NotificationChannel;
  recipientEmail: string | null;
  recipientPhone: string | null;
  type: string;
  subject: string;
  body: string;
  relatedEntityType: string;
  relatedEntityId: string;
  status: DeliveryStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
}

async function log(supabase: AdminClient, entry: LogInput): Promise<void> {
  await supabase.from("notifications").insert({
    clinic_id: entry.clinicId,
    recipient_email: entry.recipientEmail,
    recipient_phone: entry.recipientPhone,
    notification_type: entry.type,
    channel: entry.channel,
    subject: entry.subject,
    body: entry.body,
    related_entity_type: entry.relatedEntityType,
    related_entity_id: entry.relatedEntityId,
    provider_message_id: entry.providerMessageId,
    delivery_status: entry.status,
    error_message: entry.errorMessage,
  });
}

/**
 * True when this clinic has not yet replaced the placeholder credentials
 * written at provisioning time. Attempting a send would fail every time and
 * fill the log with noise, so those attempts are recorded as SKIPPED instead.
 */
function emailConfigured(config: ClinicConfig): boolean {
  return !isPlaceholder(config.resend_api_key) && !isPlaceholder(config.resend_sender_email);
}

function whatsAppConfigured(config: ClinicConfig): boolean {
  return (
    !isPlaceholder(config.whatsapp_api_url) &&
    !isPlaceholder(config.whatsapp_access_token) &&
    !isPlaceholder(config.whatsapp_phone_number_id)
  );
}

/**
 * Sends a patient notification over every channel the clinic has configured
 * and the patient has contact details for, then logs each attempt.
 *
 * Safe to call from any server action. Returns nothing and reports nothing to
 * the caller — the log is the record of what happened.
 */
export async function notifyPatient(input: NotifyInput): Promise<void> {
  try {
    const supabase = createAdminClient();

    // RLS is bypassed here, so clinic_id is filtered explicitly on every read.
    const [{ data: patient }, { data: clinic }, { data: config }] = await Promise.all([
      supabase
        .from("patients")
        .select("first_name, last_name, email, phone")
        .eq("id", input.patientId)
        .eq("clinic_id", input.clinicId)
        .maybeSingle<Pick<Patient, "first_name" | "last_name" | "email" | "phone">>(),
      supabase
        .from("clinics")
        .select("name")
        .eq("id", input.clinicId)
        .maybeSingle<Pick<Clinic, "name">>(),
      supabase
        .from("clinic_config")
        .select("*")
        .eq("clinic_id", input.clinicId)
        .maybeSingle<ClinicConfig>(),
    ]);

    if (!patient || !clinic || !config) return;

    const message = renderNotification(input.event, {
      patientName: patientDisplayName(patient),
      clinicName: clinic.name,
    });

    const base = {
      clinicId: input.clinicId,
      type: message.type,
      subject: message.subject,
      body: message.body,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    };

    const outcome = (result: SendResult) =>
      result.ok
        ? { status: "SENT" as const, providerMessageId: result.providerMessageId, errorMessage: null }
        : { status: "FAILED" as const, providerMessageId: null, errorMessage: result.error };

    if (patient.email) {
      const result = emailConfigured(config)
        ? outcome(await sendEmail(config, patient.email, message.subject, message.body))
        : {
            status: "SKIPPED" as const,
            providerMessageId: null,
            errorMessage: "Resend credentials are still placeholders",
          };

      await log(supabase, {
        ...base,
        channel: "EMAIL",
        recipientEmail: patient.email,
        recipientPhone: null,
        ...result,
      });
    }

    if (patient.phone) {
      const result = whatsAppConfigured(config)
        ? outcome(await sendWhatsApp(config, patient.phone, message.body))
        : {
            status: "SKIPPED" as const,
            providerMessageId: null,
            errorMessage: "WhatsApp credentials are still placeholders",
          };

      await log(supabase, {
        ...base,
        channel: "WHATSAPP",
        recipientEmail: null,
        recipientPhone: patient.phone,
        ...result,
      });
    }
  } catch {
    // Swallowed on purpose. The action that called this has already committed
    // its own work, and a notification problem must not undo it or surface as
    // a failure to the user.
  }
}
