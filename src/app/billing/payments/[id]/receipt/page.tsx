import { notFound } from "next/navigation";

import { PrintButton } from "@/components/common/PrintButton";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  formatMoney,
  PAYMENT_METHOD_LABELS,
  type Invoice,
  type Payment,
} from "@/types/billing";
import {
  DEFAULT_LETTERHEAD_GAP_PERCENT,
  letterheadGapToMm,
  type Clinic,
} from "@/types/clinic";
import { patientDisplayName, type Patient } from "@/types/patient";
import { BILLING_ROLES } from "@/types/user";

import styles from "../../../print.module.css";

/**
 * Print-friendly payment receipt — proof of one tender, not of the whole bill.
 *
 * A patient who paid in two instalments gets two receipts, each showing what
 * that payment left outstanding at the time it was taken.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(BILLING_ROLES);
  const clinicId = requireClinicId(profile);
  const { id } = await params;

  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .maybeSingle<Payment>();

  if (!payment) notFound();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", payment.invoice_id)
    .eq("clinic_id", clinicId)
    .maybeSingle<Invoice>();

  if (!invoice) notFound();

  const [{ data: clinic }, { data: patient }] = await Promise.all([
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
  ]);

  const gapPercent = clinic?.letterhead_gap_percent ?? DEFAULT_LETTERHEAD_GAP_PERCENT;

  return (
    <main className={styles.sheet}>
      <div className={styles.noPrint}>
        <PrintButton />
      </div>

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
          <h1 className={styles.title}>Receipt</h1>
          <div className={styles.muted}>Against invoice {invoice.invoice_number}</div>
        </div>
        <div className={styles.right}>
          <div>
            <strong>{patient ? patientDisplayName(patient) : "Patient"}</strong>
          </div>
          <div className={styles.muted}>{patient?.patient_number}</div>
          <div className={styles.muted}>Date: {payment.payment_date}</div>
        </div>
      </section>

      <section className={styles.section}>
        <table className={styles.table}>
          <tbody>
            <tr>
              <th>Amount received</th>
              <td className={styles.numeric}>{formatMoney(payment.amount)}</td>
            </tr>
            <tr>
              <th>Mode of payment</th>
              <td className={styles.numeric}>{PAYMENT_METHOD_LABELS[payment.method]}</td>
            </tr>
            {payment.reference_number ? (
              <tr>
                <th>Reference</th>
                <td className={styles.numeric}>{payment.reference_number}</td>
              </tr>
            ) : null}
            <tr>
              <th>Invoice total</th>
              <td className={styles.numeric}>{formatMoney(invoice.total_amount)}</td>
            </tr>
            <tr>
              <th>Balance outstanding</th>
              <td className={styles.numeric}>{formatMoney(invoice.balance_amount)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {payment.notes ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Notes</h2>
          <p>{payment.notes}</p>
        </section>
      ) : null}

      <footer className={styles.footer}>
        <div className={styles.stamp}>
          {invoice.balance_amount <= 0 ? "Paid in full" : "Part payment"}
        </div>
        <div className={styles.signature}>
          <div className={styles.signatureLine} />
          <div className={styles.muted}>Received by</div>
        </div>
      </footer>
    </main>
  );
}
