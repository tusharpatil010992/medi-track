"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import { useState, useTransition } from "react";

import { issueInvoice, setInvoiceStatus } from "@/features/billing/actions";
import { type InvoiceStatus } from "@/types/billing";

/**
 * Issue, cancel and void.
 *
 * These throw server-side rather than returning a message, because every one of
 * them is already prevented by the buttons on offer — reaching the error means
 * the page was stale, not that the user did something ordinary.
 */
export function InvoiceActions({
  invoiceId,
  status,
  paidAmount,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  paidAmount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (work: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await work();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Something went wrong.");
      }
    });
  };

  const closed = status === "CANCELLED" || status === "VOID";
  const canClose = !closed && paidAmount === 0;

  return (
    <>
      <Stack direction="row" spacing={1}>
        {status === "DRAFT" ? (
          <Button
            variant="contained"
            disabled={isPending}
            onClick={() => run(() => issueInvoice(invoiceId))}
          >
            Issue invoice
          </Button>
        ) : null}

        {canClose ? (
          <Button
            variant="outlined"
            color="error"
            disabled={isPending}
            onClick={() => run(() => setInvoiceStatus(invoiceId, "CANCELLED"))}
          >
            Cancel
          </Button>
        ) : null}

        {canClose && status !== "DRAFT" ? (
          <Button
            variant="outlined"
            color="error"
            disabled={isPending}
            onClick={() => run(() => setInvoiceStatus(invoiceId, "VOID"))}
          >
            Void
          </Button>
        ) : null}
      </Stack>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
