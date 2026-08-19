"use server";

import { revalidatePath } from "next/cache";

import { requireClinicId, requireRole } from "@/lib/auth/session";
import { notifyPatient } from "@/lib/notifications/dispatch";
import { dailyPrefix, nextReference } from "@/lib/reference-numbers";
import { createClient } from "@/lib/supabase/server";
import {
  acceptsPayment,
  computeInvoiceTotals,
  computeSubtotal,
  discountFromPercent,
  isInvoiceEditable,
  MAX_DISCOUNT_PERCENT,
  PAYMENT_METHODS,
  round2,
  statusAfterPayment,
  type Invoice,
  type InvoiceItem,
  type Payment,
  type PaymentMethod,
} from "@/types/billing";

/**
 * Roles permitted to transact.
 *
 * ADMIN is deliberately absent: it maintains the price list and reads every
 * billing record, but does not raise invoices or take money. RLS in migration
 * 0006 enforces the same split at the database.
 */
const BILLING_WRITERS = ["DOCTOR", "FRONT_DESK"] as const;

export interface InvoiceFormState {
  error: string | null;
  invoiceId: string | null;
}

export interface PaymentFormState {
  error: string | null;
  success: boolean;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface LineInput {
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Reads the repeating line rows.
 *
 * The form posts parallel arrays; a row counts only when it carries a
 * description, so blank spare rows are ignored — the same shape the
 * prescription form uses.
 */
function readLines(formData: FormData): LineInput[] | string {
  const serviceIds = formData.getAll("item_service_id").map(String);
  const descriptions = formData.getAll("item_description").map(String);
  const quantities = formData.getAll("item_quantity").map(String);
  const unitPrices = formData.getAll("item_unit_price").map(String);

  const lines: LineInput[] = [];

  for (let i = 0; i < descriptions.length; i += 1) {
    const description = (descriptions[i] ?? "").trim();
    if (!description) continue;

    const quantity = Number((quantities[i] ?? "1").trim() || "1");
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return `"${description}" needs a whole quantity of at least 1.`;
    }

    const unitPrice = Number((unitPrices[i] ?? "").trim());
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return `"${description}" needs a price of zero or more.`;
    }

    lines.push({
      serviceId: (serviceIds[i] ?? "").trim() || null,
      description,
      quantity,
      unitPrice,
    });
  }

  return lines;
}

function readAmount(formData: FormData, key: string): number | string {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return 0;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return `${key.replace(/_/g, " ")} must be zero or more.`;
  return round2(value);
}

/**
 * Allocates the next clinic-scoped invoice number, e.g. INV260818007.
 *
 * Same approach as patient numbers: read the day's references, take the next,
 * and rely on the UNIQUE(clinic_id, invoice_number) constraint plus a retry to
 * settle a race.
 */
async function nextInvoiceNumber(supabase: SupabaseClient, clinicId: string): Promise<string> {
  const prefix = dailyPrefix("INV");

  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("clinic_id", clinicId)
    .like("invoice_number", `${prefix}%`)
    .returns<{ invoice_number: string }[]>();

  return nextReference(prefix, (data ?? []).map((row) => row.invoice_number));
}

/** Replaces an invoice's lines wholesale. Only ever called on a draft. */
async function replaceLines(
  supabase: SupabaseClient,
  clinicId: string,
  invoiceId: string,
  lines: readonly LineInput[],
): Promise<string | null> {
  await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("clinic_id", clinicId);

  if (lines.length === 0) return null;

  const { error } = await supabase.from("invoice_items").insert(
    lines.map((line) => ({
      clinic_id: clinicId,
      invoice_id: invoiceId,
      service_id: line.serviceId,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      amount: round2(line.quantity * line.unitPrice),
    })),
  );

  return error ? `Could not save invoice lines: ${error.message}` : null;
}

/**
 * Creates or updates the draft invoice for a visit.
 *
 * Totals are always recomputed from the lines here. Anything the browser posts
 * as a subtotal or a total is ignored outright — the patient pays what the
 * server calculates.
 */
export async function saveInvoice(
  _prevState: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const profile = await requireRole(BILLING_WRITERS);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();

  const consultationId = String(formData.get("consultation_id") ?? "").trim() || null;
  let patientId = String(formData.get("patient_id") ?? "").trim() || null;

  // A consultation is the authority on whose bill this is; the posted
  // patient_id is never trusted when one is present.
  if (consultationId) {
    const { data: consultation } = await supabase
      .from("consultations")
      .select("id, patient_id")
      .eq("id", consultationId)
      .eq("clinic_id", clinicId)
      .maybeSingle<{ id: string; patient_id: string }>();

    if (!consultation) return { error: "Consultation not found in this clinic.", invoiceId: null };
    patientId = consultation.patient_id;
  }

  if (!patientId) return { error: "Select a patient.", invoiceId: null };

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle<{ id: string }>();

  if (!patient) return { error: "Patient not found in this clinic.", invoiceId: null };

  const lines = readLines(formData);
  if (typeof lines === "string") return { error: lines, invoiceId: null };
  if (lines.length === 0) return { error: "Add at least one billing line.", invoiceId: null };

  const tax = readAmount(formData, "tax_amount");
  if (typeof tax === "string") return { error: tax, invoiceId: null };

  // The form posts a percentage; the rupee value is derived here from the
  // server's own line totals, so a tampered amount cannot reach the ledger.
  const discountPercent = readAmount(formData, "discount_percent");
  if (typeof discountPercent === "string") return { error: discountPercent, invoiceId: null };
  if (discountPercent > MAX_DISCOUNT_PERCENT) {
    return { error: `A discount cannot exceed ${MAX_DISCOUNT_PERCENT}%.`, invoiceId: null };
  }

  const discount = discountFromPercent(
    computeSubtotal(lines.map((line) => ({ quantity: line.quantity, unitPrice: line.unitPrice }))),
    tax,
    discountPercent,
  );

  const discountReason = String(formData.get("discount_reason") ?? "").trim() || null;
  if (discount > 0 && !discountReason) {
    return { error: "A discount needs a reason. Say why it was given.", invoiceId: null };
  }

  const notes = String(formData.get("notes") ?? "").trim() || null;

  // Find what this save is editing: an invoice named outright, otherwise the
  // most recent one raised for this visit.
  const invoiceId = String(formData.get("invoice_id") ?? "").trim() || null;
  let existing: Pick<Invoice, "id" | "status" | "paid_amount"> | null = null;

  if (invoiceId) {
    const { data } = await supabase
      .from("invoices")
      .select("id, status, paid_amount")
      .eq("id", invoiceId)
      .eq("clinic_id", clinicId)
      .maybeSingle<Pick<Invoice, "id" | "status" | "paid_amount">>();

    existing = data ?? null;
  } else if (consultationId) {
    // Newest first, not maybeSingle: a visit whose first invoice was cancelled
    // legitimately has more than one, and asking for a single row would error.
    const { data } = await supabase
      .from("invoices")
      .select("id, status, paid_amount")
      .eq("consultation_id", consultationId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<Pick<Invoice, "id" | "status" | "paid_amount">[]>();

    existing = data?.[0] ?? null;
  }

  // A cancelled or void invoice is not edited back to life — the visit simply
  // gets a fresh one, which is what the completion gate tells the user to do.
  if (existing && (existing.status === "CANCELLED" || existing.status === "VOID")) {
    existing = null;
  }

  if (existing && !isInvoiceEditable(existing.status)) {
    return {
      error: "This invoice has been issued and its lines can no longer be changed.",
      invoiceId: existing.id,
    };
  }

  const totals = computeInvoiceTotals(
    lines.map((line) => ({ quantity: line.quantity, unitPrice: line.unitPrice })),
    tax,
    discount,
    existing?.paid_amount ?? 0,
  );

  const monetary = {
    subtotal: totals.subtotal,
    tax_amount: tax,
    discount_amount: discount,
    discount_reason: discountReason,
    total_amount: totals.totalAmount,
    balance_amount: totals.balanceAmount,
    notes,
    updated_at: new Date().toISOString(),
    updated_by: profile.id,
  };

  if (existing) {
    const { error } = await supabase
      .from("invoices")
      .update(monetary)
      .eq("id", existing.id)
      .eq("clinic_id", clinicId);

    if (error) return { error: `Could not save invoice: ${error.message}`, invoiceId: null };

    const lineError = await replaceLines(supabase, clinicId, existing.id, lines);
    if (lineError) return { error: lineError, invoiceId: existing.id };

    revalidatePath("/billing");
    revalidatePath(`/billing/invoices/${existing.id}`);
    if (consultationId) revalidatePath(`/consultations/${consultationId}`);

    return { error: null, invoiceId: existing.id };
  }

  const today = new Date().toISOString().slice(0, 10);

  // Retry covers two users raising a bill at the same moment.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invoiceNumber = await nextInvoiceNumber(supabase, clinicId);

    const { data: created, error } = await supabase
      .from("invoices")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        consultation_id: consultationId,
        invoice_number: invoiceNumber,
        invoice_date: today,
        status: "DRAFT",
        paid_amount: 0,
        ...monetary,
        created_by: profile.id,
      })
      .select("id")
      .single<{ id: string }>();

    if (!error && created) {
      const lineError = await replaceLines(supabase, clinicId, created.id, lines);
      if (lineError) return { error: lineError, invoiceId: created.id };

      revalidatePath("/billing");
      revalidatePath(`/billing/invoices/${created.id}`);
      if (consultationId) revalidatePath(`/consultations/${consultationId}`);

      return { error: null, invoiceId: created.id };
    }

    // 23505 = unique_violation on the invoice number. Nothing else is retryable.
    if (error?.code !== "23505") {
      return { error: `Could not create invoice: ${error?.message}`, invoiceId: null };
    }
  }

  return { error: "Could not allocate an invoice number. Please try again.", invoiceId: null };
}

/**
 * Finalises a draft so it can be paid.
 *
 * Totals are recomputed from the stored lines rather than trusted from the
 * draft row, so an invoice cannot be issued for an amount its own lines do not
 * add up to.
 */
export async function issueInvoice(invoiceId: string): Promise<void> {
  const profile = await requireRole(BILLING_WRITERS);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("clinic_id", clinicId)
    .maybeSingle<Invoice>();

  if (!invoice) throw new Error("Invoice not found");
  if (!isInvoiceEditable(invoice.status)) {
    throw new Error("Only a draft invoice can be issued");
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("quantity, unit_price")
    .eq("invoice_id", invoiceId)
    .eq("clinic_id", clinicId)
    .returns<Pick<InvoiceItem, "quantity" | "unit_price">[]>();

  if (!items || items.length === 0) {
    throw new Error("An invoice needs at least one line before it can be issued");
  }

  const totals = computeInvoiceTotals(
    items.map((item) => ({ quantity: item.quantity, unitPrice: item.unit_price })),
    invoice.tax_amount,
    invoice.discount_amount,
    invoice.paid_amount,
  );

  await supabase
    .from("invoices")
    .update({
      status: "ISSUED",
      subtotal: totals.subtotal,
      total_amount: totals.totalAmount,
      balance_amount: totals.balanceAmount,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", invoiceId)
    .eq("clinic_id", clinicId);

  await notifyPatient({
    clinicId,
    patientId: invoice.patient_id,
    event: {
      type: "INVOICE_CREATED",
      invoiceNumber: invoice.invoice_number,
      totalAmount: totals.totalAmount,
      balanceAmount: totals.balanceAmount,
    },
    relatedEntityType: "invoice",
    relatedEntityId: invoiceId,
  });

  revalidatePath("/billing");
  revalidatePath(`/billing/invoices/${invoiceId}`);
  if (invoice.consultation_id) revalidatePath(`/consultations/${invoice.consultation_id}`);
}

/**
 * Records one tender against an invoice.
 *
 * A patient settling in two ways produces two rows, which is why the method is
 * captured per payment. The invoice's paid amount is re-summed from the
 * payments table afterwards rather than incremented, so the stored figure is
 * always the sum of what was actually taken.
 */
export async function recordPayment(
  _prevState: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const profile = await requireRole(BILLING_WRITERS);
  const clinicId = requireClinicId(profile);

  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  if (!invoiceId) return { error: "Missing invoice reference.", success: false };

  const method = String(formData.get("method") ?? "").trim() as PaymentMethod;
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) {
    return { error: "Select how the payment was made.", success: false };
  }

  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = round2(Number(amountRaw));
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount greater than zero.", success: false };
  }

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("clinic_id", clinicId)
    .maybeSingle<Invoice>();

  if (!invoice) return { error: "Invoice not found.", success: false };

  if (!acceptsPayment(invoice.status)) {
    return {
      error:
        invoice.status === "DRAFT"
          ? "Issue this invoice before recording a payment against it."
          : `A ${invoice.status.toLowerCase().replace("_", " ")} invoice cannot take further payment.`,
      success: false,
    };
  }

  if (amount > round2(invoice.balance_amount)) {
    return { error: "That is more than the outstanding balance.", success: false };
  }

  const { error: insertError } = await supabase.from("payments").insert({
    clinic_id: clinicId,
    invoice_id: invoiceId,
    payment_date: String(formData.get("payment_date") ?? "").trim() || new Date().toISOString().slice(0, 10),
    amount,
    method,
    reference_number: String(formData.get("reference_number") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: profile.id,
  });

  if (insertError) {
    return { error: `Could not record payment: ${insertError.message}`, success: false };
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId)
    .eq("clinic_id", clinicId)
    .returns<Pick<Payment, "amount">[]>();

  const paid = round2((payments ?? []).reduce((sum, payment) => sum + payment.amount, 0));
  const balance = round2(invoice.total_amount - paid);

  await supabase
    .from("invoices")
    .update({
      paid_amount: paid,
      balance_amount: balance,
      status: statusAfterPayment(invoice.total_amount, paid),
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", invoiceId)
    .eq("clinic_id", clinicId);

  await notifyPatient({
    clinicId,
    patientId: invoice.patient_id,
    event: {
      type: "PAYMENT_RECEIVED",
      invoiceNumber: invoice.invoice_number,
      amount,
      method,
      balanceAmount: balance,
    },
    relatedEntityType: "invoice",
    relatedEntityId: invoiceId,
  });

  revalidatePath("/billing");
  revalidatePath(`/billing/invoices/${invoiceId}`);
  if (invoice.consultation_id) revalidatePath(`/consultations/${invoice.consultation_id}`);

  return { error: null, success: true };
}

/**
 * Cancels or voids an invoice.
 *
 * Both require that no money has been taken. There is no refund flow in this
 * phase, and payments are immutable, so reversing a settled invoice would leave
 * the ledger claiming money that was never returned.
 */
export async function setInvoiceStatus(
  invoiceId: string,
  status: "CANCELLED" | "VOID",
): Promise<void> {
  const profile = await requireRole(BILLING_WRITERS);
  const clinicId = requireClinicId(profile);

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, paid_amount, consultation_id")
    .eq("id", invoiceId)
    .eq("clinic_id", clinicId)
    .maybeSingle<Pick<Invoice, "id" | "status" | "paid_amount" | "consultation_id">>();

  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "CANCELLED" || invoice.status === "VOID") {
    throw new Error("This invoice is already closed");
  }
  if (invoice.paid_amount > 0) {
    throw new Error("An invoice with payments against it cannot be cancelled");
  }

  await supabase
    .from("invoices")
    .update({ status, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", invoiceId)
    .eq("clinic_id", clinicId);

  revalidatePath("/billing");
  revalidatePath(`/billing/invoices/${invoiceId}`);
  if (invoice.consultation_id) revalidatePath(`/consultations/${invoice.consultation_id}`);
}
