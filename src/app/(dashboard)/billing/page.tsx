import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
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

import { InvoiceSearch } from "@/components/billing/InvoiceSearch";
import { InvoiceStatusChip } from "@/components/billing/InvoiceStatusChip";
import { requireClinicId, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, type Invoice } from "@/types/billing";
import { canRecordBilling, BILLING_ROLES } from "@/types/user";

interface InvoiceRow extends Invoice {
  patients: { first_name: string; last_name: string; patient_number: string } | null;
  /** The visit this bill came from, so invoices can be traced against consultations. */
  consultations: { consultation_number: string } | null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string }>;
}) {
  const profile = await requireRole(BILLING_ROLES);
  const clinicId = requireClinicId(profile);

  const params = await searchParams;
  const filters = {
    q: params.q ?? "",
    status: params.status ?? "",
    from: params.from ?? "",
    to: params.to ?? "",
  };

  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select("*, patients(first_name, last_name, patient_number), consultations(consultation_number)")
    .eq("clinic_id", clinicId)
    .order("invoice_date", { ascending: false })
    .order("invoice_number", { ascending: false })
    .limit(100);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("invoice_date", filters.from);
  if (filters.to) query = query.lte("invoice_date", filters.to);

  // A search term can be an invoice number, a patient, or a consultation
  // reference. The latter two are resolved to ids first, because PostgREST
  // cannot express "or" across an embedded table.
  if (filters.q) {
    const term = `%${filters.q}%`;

    const [{ data: patientMatches }, { data: consultationMatches }] = await Promise.all([
      supabase
        .from("patients")
        .select("id")
        .eq("clinic_id", clinicId)
        .or(`first_name.ilike.${term},last_name.ilike.${term},patient_number.ilike.${term}`)
        .returns<{ id: string }[]>(),
      supabase
        .from("consultations")
        .select("id")
        .eq("clinic_id", clinicId)
        .ilike("consultation_number", term)
        .returns<{ id: string }[]>(),
    ]);

    const conditions = [`invoice_number.ilike.${term}`];

    const patientIds = (patientMatches ?? []).map((patient) => patient.id);
    if (patientIds.length) conditions.push(`patient_id.in.(${patientIds.join(",")})`);

    const consultationIds = (consultationMatches ?? []).map((consultation) => consultation.id);
    if (consultationIds.length) {
      conditions.push(`consultation_id.in.(${consultationIds.join(",")})`);
    }

    query = query.or(conditions.join(","));
  }

  const { data: invoices } = await query.returns<InvoiceRow[]>();

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <div>
          <Typography variant="h1" component="h1" gutterBottom>
            Billing
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Invoices raised by this clinic, newest first.
          </Typography>
        </div>

        {canRecordBilling(profile.role) ? (
          <Button
            component={Link}
            href="/billing/invoices/new"
            variant="contained"
            startIcon={<AddIcon />}
          >
            New invoice
          </Button>
        ) : null}
      </Stack>

      <InvoiceSearch filters={filters} />

      {!invoices || invoices.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No invoices match. Bills raised from a consultation appear here too.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Consultation</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Date</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>
                  Balance
                </TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} hover>
                  <TableCell>
                    <Link href={`/billing/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
                  </TableCell>
                  <TableCell>
                    {invoice.patients
                      ? `${invoice.patients.first_name} ${invoice.patients.last_name}`
                      : "—"}
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    {invoice.consultations && invoice.consultation_id ? (
                      <Link href={`/consultations/${invoice.consultation_id}`}>
                        {invoice.consultations.consultation_number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    {invoice.invoice_date}
                  </TableCell>
                  <TableCell align="right">{formatMoney(invoice.total_amount)}</TableCell>
                  <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>
                    {formatMoney(invoice.balance_amount)}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusChip status={invoice.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
