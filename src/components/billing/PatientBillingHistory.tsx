import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { InvoiceStatusChip } from "@/components/billing/InvoiceStatusChip";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, round2, type Invoice } from "@/types/billing";
import { BILLING_ROLES, type UserRole } from "@/types/user";

/**
 * This patient's bills, on their profile.
 *
 * Clinic-scoped like everything else, and hidden entirely from roles with no
 * billing access — RLS would return nothing for them anyway, but an empty
 * "Billing" heading would wrongly suggest the patient has never been charged.
 */
export async function PatientBillingHistory({
  patientId,
  clinicId,
  role,
}: {
  patientId: string;
  clinicId: string;
  role: UserRole;
}) {
  if (!(BILLING_ROLES as readonly UserRole[]).includes(role)) return null;

  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("invoice_date", { ascending: false })
    .limit(20)
    .returns<Invoice[]>();

  const outstanding = round2(
    (invoices ?? [])
      .filter((invoice) => invoice.status !== "CANCELLED" && invoice.status !== "VOID")
      .reduce((sum, invoice) => sum + invoice.balance_amount, 0),
  );

  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 1 }}
        >
          <Typography variant="h4" component="h2">
            Billing
          </Typography>
          {outstanding > 0 ? (
            <Typography variant="body2" color="warning.main">
              {formatMoney(outstanding)} outstanding
            </Typography>
          ) : null}
        </Stack>

        {!invoices || invoices.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No invoices raised for this patient.
          </Typography>
        ) : (
          <Stack divider={<Divider />}>
            {invoices.map((invoice) => (
              <Stack
                key={invoice.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ py: 1, justifyContent: "space-between", alignItems: { sm: "center" } }}
              >
                <Typography variant="body2">
                  <Link href={`/billing/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
                  <Typography component="span" variant="body2" color="text.secondary">
                    {" "}
                    · {invoice.invoice_date}
                  </Typography>
                </Typography>

                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="body2">{formatMoney(invoice.total_amount)}</Typography>
                  <InvoiceStatusChip status={invoice.status} />
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
