# Phase 4.4 — Master Data nav group and percentage discounts

> Two UI changes. The three clinic reference lists collapse under one sidebar
> heading, and the invoice discount field became a percentage — so `100` waives
> a bill instead of taking ₹100 off it.

**Status:** Complete. No migration; 147/147 isolation tests passing.
**Date:** 2026-08-20
**Scope:** the sidebar and the invoice editor. No schema change, no RLS change,
no Phase 5 work.

---

## 1. The discount was not broken

Worth stating plainly, because it was reported as a bug: `discount_amount` is a
currency column and always has been. Entering `1000` to clear a ₹1000 bill was
the field working exactly as built.

What was wrong is that the field was labelled **"Discount"** with no unit, while
the requirement it exists to serve is written in percentages — *"Family Friends
… will be discount 100% with free text reason"* (Phase 4, §2). Two different
things called the same word, and the form never offered the one the clinic
actually thinks in.

Three options were put up: relabel it as rupees, add a ₹/% toggle, or make it a
percentage outright. **Percentage outright was chosen.**

The consequence is deliberate and worth knowing: **a clinic can no longer take a
flat ₹50 off a bill.** Every discount is now a proportion. If a flat concession
comes up, it has to be expressed as a percentage of that particular bill, or the
line itself has to be repriced.

## 2. Where the percentage is applied, and why it matters

On the **taxed** bill — `subtotal + tax` — not the subtotal alone.

The total is computed as `subtotal + tax − discount`. Taking 100% of the
subtotal only would leave the tax still payable:

| | Subtotal | Tax | Discount | Total |
|---|---|---|---|---|
| Percent on subtotal only | ₹1000 | ₹50 | ₹1000 | **₹50** |
| Percent on the taxed bill | ₹1000 | ₹50 | ₹1050 | **₹0** |

A fully waived visit that still bills ₹50 of tax is not a waived visit, and the
waived visit is the entire reason the discount exists. The suite asserts both
rows above — the second as the requirement, the first as the mistake nobody
should reintroduce.

## 3. Trust boundary

The form posts `discount_percent`. The **server resolves it to rupees against
its own line totals**, never against a figure the browser computed:

```typescript
const discount = discountFromPercent(
  computeSubtotal(lines.map(...)),   // the server's own subtotal
  tax,
  discountPercent,
);
```

This is stricter than what it replaced — the old field posted a rupee amount and
the server stored it as given. The cap is enforced twice, in the field and again
in the action, because the field's `max` attribute is a suggestion to a browser
and nothing more.

`computeSubtotal()` was extracted from `computeInvoiceTotals()` so the subtotal
has one definition rather than two. The preview in the form calls the same pair
of pure functions the server does, so what a biller sees and what is stored
cannot drift.

## 4. No percentage is stored

`invoices.discount_amount` keeps holding rupees, and no `discount_percent`
column was added. A ledger records money; the percentage is an input
convenience, and storing both would create two facts that could disagree.

The cost lands on re-opening a draft: the editor derives the percentage back out
of the stored amount. For anything entered as a percentage this round-trips
exactly. For a **flat discount raised before this change** it rarely lands on a
round figure — ₹150 on a ₹1000 bill reads back as 15%, which is exact, but
₹150 on a ₹1050 bill reads as 14.29% and re-saving would move the discount by a
fraction of a rupee. Asserted in the suite as "within a paisa", and only
reachable on a DRAFT, since an issued invoice can no longer be edited.

## 5. The sidebar group

`NavItem` gained a sibling type rather than an optional field:

```typescript
export type NavEntry = NavItem | NavGroup;
```

A `NavGroup` has children and **no href** — it cannot be navigated to, only
opened, which is what stops a heading pretending to be a page.

| Behaviour | Why |
|---|---|
| Auto-expands when it holds the active page | Landing on `/medicines` must not hide the link you arrived by |
| An explicit toggle overrides that | The user's choice outranks the guess; kept per group label |
| The heading does not close the mobile drawer | Closing it would hide the links they just asked to see. Children still close it |
| Longest matching href wins the highlight | `/billing/services` now highlights Billing Services **alone** — it used to light up Billing as well, a pre-existing wart that grouping would have made obvious |

ADMIN sees three children, DOCTOR sees one. A group holding a single link is
slightly odd, and it was chosen over flattening it so that Consultation Fields
lives in the same place for everyone who can reach it.

`aria-expanded` is on the heading, so the group's state is announced rather than
being conveyed by the chevron alone.

## 6. Files

```
src/config/navigation.ts                 NavGroup, NavEntry, isNavGroup, the Master Data group
src/components/layout/AppShell.tsx       Collapse rendering, longest-prefix highlight, aria-expanded
src/types/billing.ts                     computeSubtotal, discountFromPercent, percentFromDiscount,
                                         MAX_DISCOUNT_PERCENT
src/features/billing/actions.ts          reads discount_percent, resolves it server-side, caps at 100
src/components/billing/InvoiceForm.tsx   percentage field, live rupee preview, discount line in totals
scripts/verify-isolation.mjs             8 new arithmetic checks
```

No server action, page, policy or table was touched beyond the above. `/medicines`,
`/note-types` and `/billing/services` are unchanged — only how they are reached.

## 7. Verification

### Static
```
npm run type-check   ✓
npm run lint         ✓
npm run build        ✓  29 routes, unchanged
```

### Isolation and behaviour — 147/147

Phases 1–4.3 regress in full. Neither change touches the database, so the 139
existing checks are pure regression; the 8 new ones assert the arithmetic
directly against the pure functions.

| Check | Result |
|---|---|
| Subtotal is taken from the lines alone | ✅ |
| 10% of a ₹1000 bill is ₹100 off | ✅ |
| 100% waives a taxed bill to exactly zero | ✅ |
| Discounting the subtotal alone would have left the tax payable | ✅ |
| A zero percent discount takes nothing off | ✅ |
| A stored amount reads back as its percentage | ✅ |
| An empty bill reads back as zero percent | ✅ |
| A flat legacy discount round-trips within a paisa | ✅ |

### Not verified

The sidebar and the invoice editor have **never been driven in a browser** —
unchanged from every previous phase, and squarely relevant here since this phase
is entirely UI. Specifically unproven: that the group expands and collapses as
intended, that the mobile drawer behaves as described, that the highlight lands
on the right row, and that the discount helper text reads sensibly while a
number is being typed. Checklist in `docs/setup.md`; standing open item 6.

## 8. Open items

None added. The flat-discount capability lost in §1 is a deliberate consequence
of the chosen option, not a defect, and is recorded here rather than as an open
question.

## 9. References

- Phase 4 — [`summary/phase4_implementation.md`](phase4_implementation.md)
- Phase 4.3 — [`summary/phase4.3_implementation.md`](phase4.3_implementation.md)
- Open items — [`summary/open-items.md`](open-items.md)
- Setup & verification — [`docs/setup.md`](../docs/setup.md)
