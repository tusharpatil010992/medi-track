# Phase 4.2 — Invoice lines show amount only

> Qty and Unit price were removed from the invoice **display**, on screen and on
> the printed invoice. A billed line now reads as its description and its amount.

**Scope:** two display tables. Nothing else — no schema change, no migration, no
server-side change, no change to the invoice editor, no Phase 5 work.

---

## What changed

| Surface | Before | After |
|---|---|---|
| Invoice detail, issued/read-only ([page.tsx](../src/app/(dashboard)/billing/invoices/%5Bid%5D/page.tsx)) | Description · Qty · Unit price · Amount | Description · Amount |
| Printed invoice ([print/page.tsx](../src/app/billing/invoices/%5Bid%5D/print/page.tsx)) | Description · Qty · Unit price · Amount | Description · Amount |

Eight lines of JSX removed across two files. That is the entire change.

## The decision behind it

Two options were put up before implementing:

- **A — displays only.** Strip the columns from the two tables; leave the editor
  alone. No server-side change at all.
- **B — the editor too.** Each line becomes Service + Description + Amount, with
  the server storing `quantity: 1` and `unit_price: amount`.

**A was chosen.** The consequence is deliberate and worth stating plainly: the
invoice editor still asks for Qty and Unit price, so the two fields are removed
from what a *reader* sees, not from what a *biller* enters. A line of 3 × ₹200 is
still entered that way and still stored that way; it simply prints as ₹600.

B would have made multi-unit billing impossible to express and would have
rewritten any re-saved draft's breakdown to 1 × total. A avoids both, at the cost
of the editor and the printed document no longer matching field-for-field.

## What was deliberately not touched

- **`invoice_items.quantity` and `unit_price`** — still captured, still stored,
  still what `amount` is computed from. Retained for reporting and audit;
  showing them again later is a display change with no migration behind it.
- **`computeInvoiceTotals()`** — untouched, along with its verification coverage.
  Totals, tax, discount, the discount-reason CHECK and the completion gate all
  behave exactly as before.
- **`InvoiceForm.tsx`** — untouched, per decision A.
- **The prescription form's "Qty" field** — Phase 3 clinical, not the invoice
  section, and outside the requested scope.
- **`print.module.css`** — `.table` is `width: 100%` with no per-column rules, so
  a two-column table needed no stylesheet change.

## Files

```
src/app/(dashboard)/billing/invoices/[id]/page.tsx   items table: two columns removed
src/app/billing/invoices/[id]/print/page.tsx         printed items table: two columns removed
docs/database.md                                     invoice_items — stored but not displayed
docs/requirements.md                                 invoice items line
docs/setup.md                                        two manual verification rows
```

## Verification

| Check | Result |
|---|---|
| `npm run type-check` | Clean |
| `npm run lint` | Clean |
| `npm run build` | Succeeds; both invoice routes compile |
| `npm run verify:isolation` | 119/119, unchanged |
| Grep for `Qty` / `unit_price` in billing UI | Only `InvoiceForm.tsx`, which decision A keeps |

The isolation suite cannot regress on this change — it inserts `invoice_items`
directly through Supabase clients and never renders a page. It was run anyway to
confirm nothing else moved.

**Still to do manually:** open an issued invoice and confirm the items table
reads Description and Amount; print it and confirm the same, with the totals
block, letterhead gap and payments table unaffected; confirm a draft invoice's
editor still shows Qty and Unit price. Light and dark mode, mobile width. This
remains the standing gap recorded as open item 6 — no screen in this project has
yet been driven by hand.
