export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED"
  | "VOID";

export type PaymentMethod = "CASH" | "CARD" | "UPI" | "BANK_TRANSFER" | "OTHER";

export interface BillingService {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface Invoice {
  id: string;
  clinic_id: string;
  patient_id: string;
  consultation_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  /** Required whenever a discount is applied. Enforced by CHECK and by the server. */
  discount_reason: string | null;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface InvoiceItem {
  id: string;
  clinic_id: string;
  invoice_id: string;
  /** Kept for reporting; the description is what the patient was actually charged for. */
  service_id: string | null;
  /** The service's name at the moment it was billed. Never rewritten. */
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  clinic_id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  VOID: "Void",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "UPI",
  "BANK_TRANSFER",
  "OTHER",
] as const satisfies readonly PaymentMethod[];

/**
 * Billing currency.
 *
 * Single constant rather than a symbol scattered through the UI. The schema
 * holds no per-clinic currency column, and every worked example in the source
 * documents is in rupees, so this is the documented currency — one place to
 * change if that ever stops being true.
 */
export const CURRENCY = "INR";

const MONEY_FORMAT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
});

export function formatMoney(amount: number): string {
  return MONEY_FORMAT.format(Number.isFinite(amount) ? amount : 0);
}

/**
 * Rounds to two decimals.
 *
 * Money arrives from the form as floats, where 0.1 + 0.2 is famously not 0.3.
 * Every computed total passes through here before it is compared or stored, so
 * a balance never lands at 0.000000001 and blocks a "fully paid" check.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface InvoiceLine {
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTotals {
  subtotal: number;
  totalAmount: number;
  balanceAmount: number;
}

/**
 * The single place invoice arithmetic lives.
 *
 * Pure and exported so it can be asserted directly by the verification suite —
 * these numbers are the ones a patient pays, so they must not be reachable only
 * through a server action. Client-submitted totals are never used anywhere;
 * this recomputes from the lines every time.
 */
export function computeInvoiceTotals(
  lines: readonly InvoiceLine[],
  taxAmount: number,
  discountAmount: number,
  paidAmount: number,
): InvoiceTotals {
  const subtotal = round2(
    lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
  );

  // Clamped at zero: a discount larger than the bill must not produce a
  // negative total that a "refund" could then be recorded against.
  const totalAmount = round2(Math.max(subtotal + taxAmount - discountAmount, 0));
  const balanceAmount = round2(totalAmount - paidAmount);

  return { subtotal, totalAmount, balanceAmount };
}

/** Status implied by how much of the invoice has been settled. */
export function statusAfterPayment(totalAmount: number, paidAmount: number): InvoiceStatus {
  if (round2(paidAmount) >= round2(totalAmount)) return "PAID";
  if (paidAmount > 0) return "PARTIALLY_PAID";
  return "ISSUED";
}

/** Lines and discounts may only change while the invoice is still a draft. */
export function isInvoiceEditable(status: InvoiceStatus): boolean {
  return status === "DRAFT";
}

/** Cancelled and void invoices take no further money; drafts are not yet payable. */
export function acceptsPayment(status: InvoiceStatus): boolean {
  return status === "ISSUED" || status === "PARTIALLY_PAID";
}

/** Statuses that end the invoice's life. */
export const CLOSED_INVOICE_STATUSES: readonly InvoiceStatus[] = ["CANCELLED", "VOID"];

/**
 * Whether this invoice satisfies the rule that a visit cannot be closed until
 * the money has been accounted for.
 *
 * A zero-total invoice passes without a payment row — that is the 100%-discount
 * path (a waived family visit), where the justification is carried by
 * discount_reason instead. Anything actually chargeable needs at least one
 * payment recorded against it, whatever the method; a shortfall is allowed and
 * simply leaves the invoice PARTIALLY_PAID.
 */
export function settlesConsultation(invoice: Pick<Invoice, "status" | "total_amount" | "paid_amount">): boolean {
  if (CLOSED_INVOICE_STATUSES.includes(invoice.status)) return false;
  if (invoice.status === "DRAFT") return false;
  if (round2(invoice.total_amount) === 0) return true;
  return invoice.paid_amount > 0;
}

/**
 * Why a visit cannot be closed yet, or null when it can.
 *
 * Pure, and separate from the query that finds the invoice, so the wording and
 * the branching are both directly assertable. `consultationBillingBlocker()`
 * fetches the invoice and defers to this.
 */
export function billingBlockerFor(
  invoice: Pick<Invoice, "status" | "total_amount" | "paid_amount"> | null,
): string | null {
  if (!invoice) {
    return "Raise the invoice for this visit before completing it. Use Billing on the consultation.";
  }

  if (invoice.status === "DRAFT") {
    return "The invoice for this visit is still a draft. Issue it before completing the visit.";
  }

  if (invoice.status === "CANCELLED" || invoice.status === "VOID") {
    return "The invoice for this visit was cancelled. Raise a new one before completing it.";
  }

  if (!settlesConsultation(invoice)) {
    return "Record the payment and its mode before completing this visit.";
  }

  return null;
}
