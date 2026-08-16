"use client";

import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import { recordPayment, type PaymentFormState } from "@/features/billing/actions";
import { formatMoney, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/types/billing";

const INITIAL_STATE: PaymentFormState = { error: null, success: false };

/**
 * Records one tender against an invoice.
 *
 * The amount defaults to the full outstanding balance, which is the common
 * case, but can be reduced — a part payment simply leaves the invoice partially
 * paid. Each tender is its own row, so a patient paying half in cash and half
 * by card is recorded as two.
 */
export function RecordPaymentForm({
  invoiceId,
  balanceAmount,
}: {
  invoiceId: string;
  balanceAmount: number;
}) {
  const [state, formAction] = useActionState(recordPayment, INITIAL_STATE);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" component="h2" gutterBottom>
          Record a payment
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Outstanding {formatMoney(balanceAmount)}
        </Typography>

        <form action={formAction} noValidate>
          <input type="hidden" name="invoice_id" value={invoiceId} />

          <Stack spacing={2}>
            {state.error ? <Alert severity="error">{state.error}</Alert> : null}
            {state.success ? <Alert severity="success">Payment recorded.</Alert> : null}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                name="amount"
                label="Amount"
                type="number"
                required
                fullWidth
                defaultValue={balanceAmount}
                slotProps={{ htmlInput: { min: "0.01", step: "0.01", max: balanceAmount } }}
              />
              <TextField
                select
                name="method"
                label="Mode of payment"
                required
                fullWidth
                defaultValue="CASH"
              >
                {PAYMENT_METHODS.map((method) => (
                  <MenuItem key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                name="payment_date"
                label="Payment date"
                type="date"
                fullWidth
                defaultValue={today}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                name="reference_number"
                label="Reference"
                fullWidth
                placeholder="UPI ref, card approval code"
              />
            </Stack>

            <TextField name="notes" label="Notes" fullWidth multiline rows={2} />

            <div>
              <SubmitButton>Record payment</SubmitButton>
            </div>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
