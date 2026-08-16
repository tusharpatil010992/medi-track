import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { InvoiceStatusChip } from "@/components/billing/InvoiceStatusChip";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, settlesConsultation, type Invoice } from "@/types/billing";
import { canRecordBilling, type UserRole } from "@/types/user";

/**
 * The billing handoff on the consultation page.
 *
 * Deliberately not an editor. Raising, discounting and collecting all happen in
 * the Billing module; this shows what the visit was billed and hands the user
 * across. The button appears only once the consultation is COMPLETED — the
 * clinical work has to be finished before there is anything to charge for.
 *
 * Fetches its own data. The consultation page is already long, and none of this
 * is needed by the rest of it.
 */
export async function ConsultationBilling({
  consultationId,
  consultationNumber,
  clinicId,
  role,
  consultationCompleted,
}: {
  consultationId: string;
  consultationNumber: string;
  clinicId: string;
  role: UserRole;
  consultationCompleted: boolean;
}) {
  const supabase = await createClient();

  // Newest first: a visit re-invoiced after a cancellation has more than one.
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("consultation_id", consultationId)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<Invoice[]>();

  const invoice = invoices?.[0] ?? null;
  const canTransact = canRecordBilling(role);

  // OPTOMETRIST and STAFF read nothing here under RLS. Rendering an empty
  // "Billing" card for them would wrongly suggest the visit was never charged.
  if (!canTransact && !invoice) return null;

  const closedInvoice = invoice?.status === "CANCELLED" || invoice?.status === "VOID";
  const needsInvoice = !invoice || closedInvoice;
  const settled = invoice ? settlesConsultation(invoice) : false;

  return (
    <Card>
      <CardContent>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <div>
            <Typography variant="h4" component="h2">
              Billing
            </Typography>
            {invoice ? (
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}
              >
                <Typography variant="body2" color="text.secondary">
                  {invoice.invoice_number} · Total {formatMoney(invoice.total_amount)} · Balance{" "}
                  {formatMoney(invoice.balance_amount)}
                </Typography>
                <InvoiceStatusChip status={invoice.status} />
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Nothing billed for this visit yet.
              </Typography>
            )}
          </div>

          {canTransact && consultationCompleted ? (
            <Button
              component={Link}
              href={
                needsInvoice
                  ? `/billing/invoices/new?consultation=${consultationId}`
                  : `/billing/invoices/${invoice.id}`
              }
              variant="contained"
              startIcon={<ReceiptLongIcon />}
            >
              {needsInvoice ? "Raise invoice" : "Open invoice"}
            </Button>
          ) : null}
        </Stack>

        {invoice?.discount_amount && invoice.discount_amount > 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Discount {formatMoney(invoice.discount_amount)}
            {invoice.discount_reason ? ` — ${invoice.discount_reason}` : ""}
          </Typography>
        ) : null}

        {/* Billing opens only after the clinical work is signed off. */}
        {canTransact && !consultationCompleted ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Complete the consultation to raise the invoice for this visit.
          </Alert>
        ) : null}

        {/* The gate that stops the appointment closing, stated before it is hit. */}
        {canTransact && consultationCompleted && !settled ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            This visit cannot be marked complete on the appointment list until the invoice is issued
            and the payment recorded. A fully discounted bill needs no payment — the reason stands in
            its place.
          </Alert>
        ) : null}

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          Invoices raised here are tracked against consultation {consultationNumber}.
        </Typography>
      </CardContent>
    </Card>
  );
}
