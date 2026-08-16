import type { ClinicConfig } from "@/types/clinic";

/**
 * Outbound provider calls for Resend and the WhatsApp Business API.
 *
 * Both are plain HTTPS endpoints, so they are called with fetch rather than by
 * adding vendor SDKs for one request each — per the rule against unnecessary
 * dependencies. Nothing here is importable from the browser: credentials come
 * from clinic_config, which the client can never read.
 */

/** A notification must never hold up a booking. Give each provider a hard ceiling. */
const REQUEST_TIMEOUT_MS = 8000;

export type SendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; error: string };

function describe(error: unknown): string {
  if (error instanceof Error) {
    // A timeout surfaces as an unhelpful bare AbortError; name the real cause.
    return error.name === "TimeoutError" || error.name === "AbortError"
      ? `Provider did not respond within ${REQUEST_TIMEOUT_MS}ms`
      : error.message;
  }
  return String(error);
}

/**
 * Truncates a provider's error body before it is stored.
 *
 * Responses can be long, and the whole thing ends up in a log an ADMIN reads.
 */
function briefly(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > 300 ? `${collapsed.slice(0, 300)}…` : collapsed;
}

export async function sendEmail(
  config: Pick<ClinicConfig, "resend_api_key" | "resend_sender_email">,
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resend_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.resend_sender_email,
        to: [to],
        subject,
        text: body,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { ok: false, error: `Resend ${response.status}: ${briefly(await response.text())}` };
    }

    const payload: unknown = await response.json();
    const id =
      payload && typeof payload === "object" && "id" in payload ? String(payload.id) : null;

    return { ok: true, providerMessageId: id };
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
}

export async function sendWhatsApp(
  config: Pick<
    ClinicConfig,
    "whatsapp_api_url" | "whatsapp_access_token" | "whatsapp_phone_number_id"
  >,
  to: string,
  body: string,
): Promise<SendResult> {
  try {
    // The clinic stores the graph base URL; the phone number id selects which
    // of its numbers sends. Trailing slashes are common in pasted values.
    const base = config.whatsapp_api_url.replace(/\/+$/, "");
    const url = `${base}/${config.whatsapp_phone_number_id}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { ok: false, error: `WhatsApp ${response.status}: ${briefly(await response.text())}` };
    }

    const payload: unknown = await response.json();
    let id: string | null = null;

    if (payload && typeof payload === "object" && "messages" in payload) {
      const messages = (payload as { messages?: unknown }).messages;
      if (Array.isArray(messages) && messages.length > 0) {
        const first: unknown = messages[0];
        if (first && typeof first === "object" && "id" in first) id = String(first.id);
      }
    }

    return { ok: true, providerMessageId: id };
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
}
