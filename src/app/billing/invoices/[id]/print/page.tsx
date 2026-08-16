import { notFound } from "next/navigation";

import { PrintButton } from "@/components/common/PrintButton";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  formatMoney,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type Invoice,
  type InvoiceItem,
  type Payment,
} from "@/types/billing";
import {
  DEFAULT_LETTERHEAD_GAP_PERCENT,
  letterheadGapToMm,
  type Clinic,
} from "@/types/clinic";
import type { Consultation } from "@/types/clinical";
import { patientDisplayName, type Patient } from "@/types/patient";
import { BILLING_ROLES } from "@/types/user";

import styles from "../../../print.module.css";

/**
 * Print-friendly invoice.
 *
 * Outside the (dashboard) group so no sidebar or app bar renders, and printed
 * with window.print() rather than a PDF service. It authenticates and
 * authorises first: the page shows a patient's name and what they were charged.
 *
 * Both DOCTOR and FRONT_DESK can print, as can ADMIN, who reads billing but
 * does not transact.
 */
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(BILLING_ROLES);
  const clinicId = requireClinicId(profile);
  const { id } = await params;

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .maybeSingle<Invoice>();

  if (!invoice) notFound();

  const [
    { data: clinic },
    { data: patient },
    { data: items },
    { data: payments },
    { data: consultation },
  ] = await Promise.all([
      supabase
        .from("clinics")
        .select("letterhead_gap_percent")
        .eq("id", clinicId)
        .maybeSingle<Pick<Clinic, "letterhead_gap_percent">>(),
      supabase
        .from("patients")
        .select("*")
        .eq("id", invoice.patient_id)
        .eq("clinic_id", clinicId)
        .maybeSingle<Patient>(),
      supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", id)
        .eq("clinic_id", clinicId)
        .order("created_at")
        .returns<InvoiceItem[]>(),
      supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", id)
        .eq("clinic_id", clinicId)
        .order("payment_date")
        .returns<Payment[]>(),
      // The visit reference is printed so a paper invoice can still be traced
      // back to the consultation it came from.
      invoice.consultation_id
        ? supabase
            .from("consultations")
            .select("consultation_number, consultation_date")
            .eq("id", invoice.consultation_id)
            .eq("clinic_id", clinicId)
            .maybeSingle<Pick<Consultation, "consultation_number" | "consultation_date">>()
        : Promise.resolve({ data: null }),
    ]);

  const gapPercent = clinic?.letterhead_gap_percent ?? DEFAULT_LETTERHEAD_GAP_PERCENT;

  return (
    <main className={styles.sheet}>
      <div className={styles.noPrint}>
        <PrintButton />
      </div>

      {/* Same reserved letterhead band as the consultation letter, so both
          documents sit correctly on the clinic's own stationery. */}
      {gapPercent > 0 ? (
        <div
          className={styles.letterheadSpace}
          style={{ height: letterheadGapToMm(gapPercent) }}
          aria-hidden="true"
        >
          <span className={styles.letterheadHint}>Letterhead area — blank when printed</span>
        </div>
      ) : null}

      <section className={styles.header}>
        <div>
          <h1 className={styles.title}>Invoice</h1>
          <div className={styles.muted}>{invoice.invoice_number}</div>
          {consultation ? (
            <div className={styles.muted}>
              Consultation {consultation.consultation_number} · {consultation.consultation_date}
            </div>
          ) : null}
        </div>
        <div className={styles.right}>
          <div>
            <strong>{patient ? patientDisplayName(patient) : "Patient"}</strong>
          </div>
          <div className={styles.muted}>{patient?.patient_number}</div>
          <div className={styles.muted}>Date: {invoice.invoice_date}</div>
        </div>
      </section>

      <section className={styles.section}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Description</th>
              <th className={styles.numeric}>Qty</th>
              <th className={styles.numeric}>Unit price</th>
              <th className={styles.numeric}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td className={styles.numeric}>{item.quantity}</td>
                <td className={styles.numeric}>{formatMoney(item.unit_price)}</td>
                <td className={styles.numeric}>{formatMoney(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.totals}>
          <div className={styles.totalsRow}>
            <span>Subtotal</span>
            <span>{formatMoney(invoice.subtotal)}</span>
          </div>
          {invoice.tax_amount > 0 ? (
            <div className={styles.totalsRow}>
              <span>Tax</span>
              <span>{formatMoney(invoice.tax_amount)}</span>
            </div>
          ) : null}
          {invoice.discount_amount > 0 ? (
            <>
              <div className={styles.totalsRow}>
                <span>Discount</span>
                <span>−{formatMoney(invoice.discount_amount)}</span>
              </div>
              {invoice.discount_reason ? (
                <div className={styles.discountReason}>{invoice.discount_reason}</div>
              ) : null}
            </>
          ) : null}
          <div className={styles.totalsGrand}>
            <span>Total</span>
            <span>{formatMoney(invoice.total_amount)}</span>
          </div>
          <div className={styles.totalsRow}>
            <span>Paid</span>
            <span>{formatMoney(invoice.paid_amount)}</span>
          </div>
          <div className={styles.totalsRow}>
            <span>Balance</span>
            <span>{formatMoney(invoice.balance_amount)}</span>
          </div>
        </div>
      </section>

      {payments && payments.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Payments received</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Reference</th>
                <th className={styles.numeric}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.payment_date}</td>
                  <td>{PAYMENT_METHOD_LABELS[payment.method]}</td>
                  <td>{payment.reference_number ?? "—"}</td>
                  <td className={styles.numeric}>{formatMoney(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {invoice.notes ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Notes</h2>
          <p>{invoice.notes}</p>
        </section>
      ) : null}

      <footer className={styles.footer}>
        <div className={styles.stamp}>{INVOICE_STATUS_LABELS[invoice.status]}</div>
        <div className={styles.signature}>
          <div className={styles.signatureLine} />
          <div className={styles.muted}>Authorised signature</div>
        </div>
      </footer>
    </main>
  );
}
