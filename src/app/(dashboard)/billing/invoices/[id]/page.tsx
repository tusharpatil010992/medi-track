import PrintIcon from "@mui/icons-material/Print";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceActions } from "@/components/billing/InvoiceActions";
import { InvoiceForm } from "@/components/billing/InvoiceForm";
import { InvoiceStatusChip } from "@/components/billing/InvoiceStatusChip";
import { RecordPaymentForm } from "@/components/billing/RecordPaymentForm";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  acceptsPayment,
  formatMoney,
  isInvoiceEditable,
  PAYMENT_METHOD_LABELS,
  type BillingService,
  type Invoice,
  type InvoiceItem,
  type Payment,
} from "@/types/billing";
import type { Consultation } from "@/types/clinical";
import { patientDisplayName, type Patient } from "@/types/patient";
import { BILLING_ROLES, canRecordBilling } from "@/types/user";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
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
    { data: patient },
    { data: items },
    { data: payments },
    { data: services },
    { data: consultation },
  ] = await Promise.all([
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
        .order("payment_date", { ascending: false })
        .returns<Payment[]>(),
      supabase
        .from("billing_services")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name")
        .returns<BillingService[]>(),
      invoice.consultation_id
        ? supabase
            .from("consultations")
            .select("id, consultation_number, consultation_date")
            .eq("id", invoice.consultation_id)
            .eq("clinic_id", clinicId)
            .maybeSingle<
              Pick<Consultation, "id" | "consultation_number" | "consultation_date">
            >()
        : Promise.resolve({ data: null }),
    ]);

  const canTransact = canRecordBilling(profile.role);
  const editable = canTransact && isInvoiceEditable(invoice.status);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <div>
          <Typography variant="h1" component="h1">
            {invoice.invoice_number}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="body2" color="text.secondary">
              {patient ? patientDisplayName(patient) : "Patient"} · {invoice.invoice_date}
            </Typography>
            <InvoiceStatusChip status={invoice.status} />
          </Stack>
        </div>

        <Stack direction="row" spacing={1}>
          <Button
            component={Link}
            href={`/billing/invoices/${invoice.id}/print`}
            variant="outlined"
            startIcon={<PrintIcon />}
          >
            Print invoice
          </Button>
          {canTransact ? (
            <InvoiceActions
              invoiceId={invoice.id}
              status={invoice.status}
              paidAmount={invoice.paid_amount}
            />
          ) : null}
        </Stack>
      </Stack>

      {profile.role === "ADMIN" ? (
        <Alert severity="info">
          Administrators maintain the price list and can review every invoice, but raising bills and
          taking payments is done by clinical and front-desk staff.
        </Alert>
      ) : null}

      {consultation ? (
        <Typography variant="body2">
          Raised from consultation{" "}
          <Link href={`/consultations/${consultation.id}`}>
            {consultation.consultation_number}
          </Link>{" "}
          on {consultation.consultation_date}.
        </Typography>
      ) : null}

      {editable ? (
        <InvoiceForm
          consultationId={invoice.consultation_id ?? undefined}
          patientId={invoice.patient_id}
          invoice={invoice}
          items={items ?? []}
          services={services ?? []}
        />
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h4" component="h2" gutterBottom>
              Items
            </Typography>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(items ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell align="right">{formatMoney(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={0.5} sx={{ alignItems: "flex-end" }}>
              <Typography variant="body2">Subtotal {formatMoney(invoice.subtotal)}</Typography>
              {invoice.tax_amount > 0 ? (
                <Typography variant="body2">Tax {formatMoney(invoice.tax_amount)}</Typography>
              ) : null}
              {invoice.discount_amount > 0 ? (
                <Typography variant="body2">
                  Discount −{formatMoney(invoice.discount_amount)}
                  {invoice.discount_reason ? ` (${invoice.discount_reason})` : ""}
                </Typography>
              ) : null}
              <Typography variant="h5" component="p">
                Total {formatMoney(invoice.total_amount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Paid {formatMoney(invoice.paid_amount)} · Balance{" "}
                {formatMoney(invoice.balance_amount)}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {canTransact && acceptsPayment(invoice.status) ? (
        <RecordPaymentForm invoiceId={invoice.id} balanceAmount={invoice.balance_amount} />
      ) : null}

      <Card>
        <CardContent>
          <Typography variant="h4" component="h2" gutterBottom>
            Payments
          </Typography>

          {!payments || payments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nothing received against this invoice yet.
            </Typography>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      Reference
                    </TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Receipt</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.payment_date}</TableCell>
                      <TableCell>{PAYMENT_METHOD_LABELS[payment.method]}</TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                        {payment.reference_number ?? "—"}
                      </TableCell>
                      <TableCell align="right">{formatMoney(payment.amount)}</TableCell>
                      <TableCell align="right">
                        <Link href={`/billing/payments/${payment.id}/receipt`}>Print</Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {invoice.notes ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {invoice.notes}
          </Typography>
        </Paper>
      ) : null}
    </Stack>
  );
}
