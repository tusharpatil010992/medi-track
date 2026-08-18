"use client";

import SearchIcon from "@mui/icons-material/Search";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/types/billing";

export interface InvoiceFilters {
  q: string;
  status: string;
  from: string;
  to: string;
}

const STATUSES = Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[];

/**
 * Billing search.
 *
 * Submitted rather than debounced: four fields are usually set together, and a
 * date range is meaningless until both ends are typed.
 */
export function InvoiceSearch({ filters }: { filters: InvoiceFilters }) {
  const [draft, setDraft] = useState(filters);
  const router = useRouter();

  const apply = () => {
    const params = new URLSearchParams();
    if (draft.q.trim()) params.set("q", draft.q.trim());
    if (draft.status) params.set("status", draft.status);
    if (draft.from) params.set("from", draft.from);
    if (draft.to) params.set("to", draft.to);

    const query = params.toString();
    router.replace(query ? `/billing?${query}` : "/billing");
  };

  const set = (field: keyof InvoiceFilters, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: "stretch" }}>
          <TextField
            label="Patient, invoice or consultation"
            placeholder="Name, P260818001, INV260818001 or C260818001"
            value={draft.q}
            onChange={(event) => set("q", event.target.value)}
            fullWidth
          />
          <TextField
            select
            label="Status"
            value={draft.status}
            onChange={(event) => set("status", event.target.value)}
            sx={{ minWidth: { md: 180 } }}
          >
            <MenuItem value="">
              <em>Any status</em>
            </MenuItem>
            {STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {INVOICE_STATUS_LABELS[status]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="From"
            type="date"
            value={draft.from}
            onChange={(event) => set("from", event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            value={draft.to}
            onChange={(event) => set("to", event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button type="submit" variant="contained" startIcon={<SearchIcon />}>
            Search
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
