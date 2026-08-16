import type { createClient } from "@/lib/supabase/server";
import { billingBlockerFor, type Invoice } from "@/types/billing";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The billing gate on closing a visit.
 *
 * Per instruction, an appointment cannot be marked complete until the money has
 * been accounted for: the bill must be issued and the mode of payment recorded.
 * Paying less than the invoice total is allowed — it simply leaves the invoice
 * PARTIALLY_PAID — and a fully discounted visit needs no payment row at all,
 * because the written discount reason is the justification in that case.
 *
 * Called from setAppointmentStatus(), not from consultation completion:
 * completing the consultation is what reveals the billing button, so gating
 * that would make the bill impossible to raise.
 *
 * This function only finds the invoice; the decision lives in
 * billingBlockerFor(), which is pure and directly tested. It sits outside the
 * "use server" module so it can take a Supabase client as an argument rather
 * than being exposed as a server action.
 */
export async function consultationBillingBlocker(
  supabase: SupabaseClient,
  clinicId: string,
  consultationId: string,
): Promise<string | null> {
  // Newest first rather than a single row: a visit whose first invoice was
  // cancelled and re-raised legitimately has more than one, and the live bill
  // is the latest.
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, status, total_amount, paid_amount")
    .eq("consultation_id", consultationId)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<Pick<Invoice, "id" | "status" | "total_amount" | "paid_amount">[]>();

  return billingBlockerFor(invoices?.[0] ?? null);
}
