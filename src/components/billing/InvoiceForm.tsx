"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/common/SubmitButton";
import { saveInvoice, type InvoiceFormState } from "@/features/billing/actions";
import {
  computeInvoiceTotals,
  computeSubtotal,
  discountFromPercent,
  formatMoney,
  MAX_DISCOUNT_PERCENT,
  percentFromDiscount,
  type BillingService,
  type Invoice,
  type InvoiceItem,
} from "@/types/billing";

const INITIAL_STATE: InvoiceFormState = { error: null, invoiceId: null };

interface Row {
  key: string;
  serviceId: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function emptyRow(): Row {
  return {
    key: crypto.randomUUID(),
    serviceId: "",
    description: "",
    quantity: "1",
    unitPrice: "",
  };
}

/**
 * Draft invoice editor.
 *
 * The totals shown here are a preview only. They are recomputed server-side
 * from the same pure function before anything is stored, so a tampered form
 * cannot change what the patient is charged.
 */
export function InvoiceForm({
  consultationId,
  patientId,
  invoice,
  items,
  services,
}: {
  consultationId?: string;
  patientId: string;
  invoice: Invoice | null;
  items: InvoiceItem[];
  services: BillingService[];
}) {
  const [state, formAction] = useActionState(saveInvoice, INITIAL_STATE);

  const [rows, setRows] = useState<Row[]>(() =>
    items.length > 0
      ? items.map((item) => ({
          key: item.id,
          serviceId: item.service_id ?? "",
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unit_price),
        }))
      : [emptyRow()],
  );

  const [tax, setTax] = useState(invoice ? String(invoice.tax_amount) : "0");
  const [discountReason, setDiscountReason] = useState(invoice?.discount_reason ?? "");

  // The stored column is a rupee amount; the field is a percentage. An invoice
  // raised before this change holds a flat discount, so its percentage is
  // derived from what was stored rather than read back directly.
  const [discountPercent, setDiscountPercent] = useState(() =>
    invoice
      ? String(
          percentFromDiscount(invoice.subtotal, invoice.tax_amount, invoice.discount_amount),
        )
      : "0",
  );

  const update = (key: string, field: keyof Omit<Row, "key">, value: string) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  /** Picking a service fills in the description and price, both still editable. */
  const chooseService = (key: string, serviceId: string) => {
    const service = services.find((candidate) => candidate.id === serviceId);
    setRows((current) =>
      current.map((row) =>
        row.key === key
          ? {
              ...row,
              serviceId,
              description: service ? service.name : row.description,
              unitPrice: service ? String(service.price) : row.unitPrice,
            }
          : row,
      ),
    );
  };

  const lines = rows
    .filter((row) => row.description.trim())
    .map((row) => ({
      quantity: Number(row.quantity) || 0,
      unitPrice: Number(row.unitPrice) || 0,
    }));

  const taxAmount = Number(tax) || 0;
  const percent = Number(discountPercent) || 0;

  // Mirrors what the server will recompute from its own lines, so the preview
  // and the saved invoice cannot disagree.
  const discountAmount = discountFromPercent(computeSubtotal(lines), taxAmount, percent);

  const preview = computeInvoiceTotals(
    lines,
    taxAmount,
    discountAmount,
    invoice?.paid_amount ?? 0,
  );

  const discountNeedsReason = percent > 0 && !discountReason.trim();
  const percentOutOfRange = percent < 0 || percent > MAX_DISCOUNT_PERCENT;

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" component="h2" gutterBottom>
          Billing
        </Typography>

        {services.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            No active services in this clinic yet. An administrator maintains the price list under
            Billing services. You can still bill a one-off line by typing it in.
          </Alert>
        ) : null}

        <form action={formAction} noValidate>
          {consultationId ? (
            <input type="hidden" name="consultation_id" value={consultationId} />
          ) : null}
          <input type="hidden" name="patient_id" value={patientId} />
          {invoice ? <input type="hidden" name="invoice_id" value={invoice.id} /> : null}

          <Stack spacing={2}>
            {state.error ? <Alert severity="error">{state.error}</Alert> : null}
            {state.invoiceId && !state.error ? (
              <Alert severity="success">Invoice saved as a draft.</Alert>
            ) : null}

            <Stack divider={<Divider />} spacing={2}>
              {rows.map((row, index) => (
                <Stack key={row.key} spacing={1.5} sx={{ pt: index === 0 ? 0 : 2 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <TextField
                      select
                      label="Service"
                      name="item_service_id"
                      value={row.serviceId}
                      onChange={(event) => chooseService(row.key, event.target.value)}
                      fullWidth
                    >
                      <MenuItem value="">
                        <em>One-off charge</em>
                      </MenuItem>
                      {services.map((service) => (
                        <MenuItem key={service.id} value={service.id}>
                          {service.name} — {formatMoney(service.price)}
                        </MenuItem>
                      ))}
                    </TextField>

                    {rows.length === 1 ? null : (
                      <IconButton
                        aria-label="Remove line"
                        onClick={() =>
                          setRows((current) => current.filter((r) => r.key !== row.key))
                        }
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Stack>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField
                      name="item_description"
                      label="Description"
                      value={row.description}
                      onChange={(event) => update(row.key, "description", event.target.value)}
                      fullWidth
                      required
                    />
                    <TextField
                      name="item_quantity"
                      label="Qty"
                      type="number"
                      value={row.quantity}
                      onChange={(event) => update(row.key, "quantity", event.target.value)}
                      slotProps={{ htmlInput: { min: "1", step: "1" } }}
                      sx={{ maxWidth: { sm: 100 } }}
                    />
                    <TextField
                      name="item_unit_price"
                      label="Unit price"
                      type="number"
                      value={row.unitPrice}
                      onChange={(event) => update(row.key, "unitPrice", event.target.value)}
                      slotProps={{ htmlInput: { min: "0", step: "0.01" } }}
                      sx={{ maxWidth: { sm: 160 } }}
                    />
                  </Stack>
                </Stack>
              ))}
            </Stack>

            <div>
              <Button
                startIcon={<AddIcon />}
                onClick={() => setRows((current) => [...current, emptyRow()])}
              >
                Add line
              </Button>
            </div>

            <Divider />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                name="tax_amount"
                label="Tax"
                type="number"
                value={tax}
                onChange={(event) => setTax(event.target.value)}
                slotProps={{ htmlInput: { min: "0", step: "0.01" } }}
                fullWidth
              />
              <TextField
                name="discount_percent"
                label="Discount %"
                type="number"
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value)}
                slotProps={{
                  htmlInput: { min: "0", max: String(MAX_DISCOUNT_PERCENT), step: "0.01" },
                }}
                fullWidth
                error={percentOutOfRange}
                helperText={
                  percentOutOfRange
                    ? `Enter between 0 and ${MAX_DISCOUNT_PERCENT}.`
                    : `${percent}% — ${formatMoney(discountAmount)} off the taxed bill`
                }
              />
            </Stack>

            <TextField
              name="discount_reason"
              label="Reason for discount"
              value={discountReason}
              onChange={(event) => setDiscountReason(event.target.value)}
              fullWidth
              required={percent > 0}
              error={discountNeedsReason}
              helperText={
                discountNeedsReason
                  ? "Say why the discount was given — a waived family visit, a concession, anything."
                  : "Required whenever a discount is applied."
              }
            />

            <TextField
              name="notes"
              label="Invoice notes"
              defaultValue={invoice?.notes ?? ""}
              fullWidth
              multiline
              rows={2}
            />

            <Stack spacing={0.5} sx={{ alignItems: "flex-end" }}>
              <Typography variant="body2" color="text.secondary">
                Subtotal {formatMoney(preview.subtotal)}
              </Typography>
              {discountAmount > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Discount ({percent}%) −{formatMoney(discountAmount)}
                </Typography>
              ) : null}
              <Typography variant="h5" component="p">
                Total {formatMoney(preview.totalAmount)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Recalculated on the server when saved
              </Typography>
            </Stack>

            <div>
              <SubmitButton>Save draft</SubmitButton>
            </div>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
