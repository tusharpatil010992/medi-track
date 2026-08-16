# Phase 4 — Implementation Summary

**Scope:** Billing & Notifications — services master, invoices, payments, printing, and the outbound notification service
**Status:** Complete. Migrations 0006 and 0007 applied.
**Date:** 2026-08-16

> **Amended after delivery** — see [§8](#8-amendment-the-consultation--billing-handoff).
> The billing gate moved from consultation completion to **appointment**
> completion, billing moved out of the consultation page into the Billing
> module behind a button, and consultations gained a `C-0001` reference.
> Statements below carrying an *(amended)* marker describe the original build.

---

## 1. What was delivered

| Phase 4 requirement (`docs/requirements.md`) | Delivered |
|---|---|
| Billing services master, ADMIN-managed | `/billing/services`, add and deactivate |
| `is_active`, never hard-delete | Deactivated services stay on historical invoices |
| Invoices from a consultation or standalone | Billing section on the consultation page; `/billing/invoices/new` |
| `unique(clinic_id, invoice_number)` | `INV-0001` allocated per clinic with retry on collision |
| Invoice items with pricing | Line rows with service pick-list plus one-off charges |
| Server-calculated totals | `computeInvoiceTotals()` — client totals ignored entirely |
| Status `DRAFT → ISSUED → PARTIALLY_PAID/PAID → CANCELLED/VOID` | Enforced; issued invoices lock their lines |
| Payment methods CASH/CARD/UPI/BANK_TRANSFER/OTHER | One row per tender, so split payments work |
| Payment cannot exceed outstanding balance | Server-side, against a re-read balance |
| Cancelled/void take no payment | Refused with the reason |
| Invoice and receipt print pages | `/billing/invoices/[id]/print`, `/billing/payments/[id]/receipt` |
| Billing search — patient, number, date range, status | `/billing` with all four filters |
| Patient billing history | Section on `/patients/[id]` with outstanding total |
| Centralised notification service, server-only | `src/lib/notifications/` |
| Email via Resend, WhatsApp via Business API | Plain `fetch` — no new dependencies |
| Graceful fallback on missing credentials | Logged `SKIPPED`, never attempted, never fatal |
| `notifications` log with delivery status | ADMIN-readable log surfaced in Clinic Settings |

Not built, by design: medical documents, audit logs, security test suite,
production deployment. Those are Phase 5.

`APPOINTMENT_REMINDER` exists in the enum and has a template, but is **not
wired** — it is the one event needing a scheduler, and Vercel Cron was not in
scope. `PRESCRIPTION_ISSUED` is likewise defined but unwired: it would fire on
every re-save of a prescription, which is noise rather than news.

---

## 2. Instructions that reshaped the plan

Four decisions came from the user mid-plan and are the reason this phase does
not look like the documented sketch.

### Billing is clinical-staff-operated, ADMIN-supervised

> *"DOCTOR and FRONTDESK can invoice and take payment. Keep admin view only."*

ADMIN owns the price list and reads every billing record but **cannot raise an
invoice or record a payment**. This inverts the usual expectation and is
enforced in RLS, not in the UI — the suite asserts ADMIN is refused `42501` on
both.

### A visit cannot close until the money is accounted for *(amended — see §8)*

> *"Also Mention Mode of payment and it shall be saved without which a
> appointment cannot be marked as complete."*

Completing a consultation is gated on an issued invoice with a payment recorded.
*(The gate later moved to appointment completion, which is what the instruction
actually said; the payment rules below are unchanged.)* Two clarifications from
the user shaped the exact rule:

- **Part payment is enough to close.** *"If Amount is settled less then what is
  generated then status should be partially paid."* A shortfall leaves the
  invoice `PARTIALLY_PAID`; it does not hold the visit open.
- **A fully discounted visit needs no payment.** *"If for example Family Friends
  is visited then it will be dicount 100% with free text reason."* A zero-total
  invoice satisfies the gate on its own — the written reason stands in place of
  the money.

### Discounts must be justified

`invoices.discount_reason` was added, with a CHECK constraint making it
unskippable: `discount_amount = 0 OR discount_reason IS NOT NULL`. The rule is
in the database rather than only in the form, because it is the only thing
making a 100% waiver auditable.

### Billing lives inside the consultation *(amended — see §8)*

> *"Once consultation is complete Billing module shall be enabled … Dr can add
> more billing entries."*

Taken literally this deadlocks: billing waits on completion, completion waits on
payment. Resolved by unlocking the billing section while the consultation is
**in progress**, and gating only the Complete button. Same intent, no deadlock.

*(Superseded. The deadlock was later resolved the other way round — by moving
the gate to the appointment — which allowed billing to sit after completion, as
originally described.)*

---

## 3. Deviations from the documented schema

Three columns are not in `docs/database.md`. Two were approved explicitly; the
third follows from the discount instruction. All are now documented.

| Addition | Why |
|---|---|
| `invoice_items.service_id` | `description` is the name snapshot and must never change; without the FK, revenue-by-service can never be reported. Mirrors `prescription_items.medicine_id` + `medicine_name_snapshot` exactly |
| `notifications.provider_message_id` | Without it a `SENT` row cannot be traced back to Resend or WhatsApp when a patient says a message never arrived |
| `invoices.discount_reason` | Required by the discount instruction above |

Two documented conflicts were resolved in favour of `docs/database.md` over the
older `plan/Mark1.md` sketch: `billing_services.price` (not
`default_amount`/`tax_rate`), and the `notifications` column set.

One value beyond the documented set: `delivery_status` can be **SKIPPED**,
meaning the clinic is still on placeholder credentials so nothing was attempted.
Logging those as FAILED would bury genuine failures.

---

## 4. The notification service bypasses RLS, deliberately

`src/lib/notifications/dispatch.ts` reads `clinic_config` with the
**service-role key**.

`clinic_config` is ADMIN-readable only, because it holds live credentials. But
the people who trigger notifications are FRONT_DESK booking an appointment and
DOCTOR taking a payment — neither can read it. The choice was between exposing
credentials clinic-wide and running the send path above RLS. The second is
safer.

The tenancy RLS would have applied is applied by hand instead: every query in
that module filters on a `clinic_id` that came from the caller's authenticated
profile, never from a request body.

**Nothing there ever throws.** A dead provider, an expired key or a slow network
must not roll back the booking or payment that triggered it. Each provider call
carries an 8-second ceiling, and every outcome — including failure — is recorded
against the notification row.

---

## 5. Files

### Migration
```
supabase/migrations/0006_phase4_billing_notifications.sql
```
4 enums · 5 tables · 16 RLS policies · indexes · 6 CHECK constraints.

### Server actions and logic
```
src/features/billing/actions.ts               saveInvoice, issueInvoice, recordPayment, setInvoiceStatus
src/features/billing/consultation-billing.ts  the completion gate (not a server action, by design)
src/features/billing-services/actions.ts      ADMIN price-list CRUD
src/lib/notifications/dispatch.ts             notifyPatient — the only entry point
src/lib/notifications/providers.ts            Resend + WhatsApp over plain fetch
src/lib/notifications/templates.ts            events as a discriminated union
src/types/billing.ts                          types + computeInvoiceTotals + the gate predicates
src/types/notification.ts                     types + labels
```

### UI
```
src/app/(dashboard)/billing/                  list + search, services master, invoice detail, new invoice
src/app/billing/invoices/[id]/print/          invoice, outside the dashboard shell
src/app/billing/payments/[id]/receipt/        receipt
src/app/billing/print.module.css              shared print stylesheet
src/components/billing/                       InvoiceForm, RecordPaymentForm, InvoiceActions,
                                              InvoiceSearch, InvoiceStatusChip, PatientPicker,
                                              ConsultationBilling, PatientBillingHistory,
                                              BillingServiceForm, BillingServiceStatusToggle
src/components/settings/NotificationLog.tsx   ADMIN-only delivery log
```

`PrintButton` moved from `components/consultations/` to `components/common/` now
that three print pages share it.

Both print routes sit **outside** the `(dashboard)` group so no sidebar renders,
and reuse the per-clinic `letterhead_gap_percent` so invoices and consultation
letters line up on the same stationery.

### Changed existing behaviour

`setConsultationStatus` and `setAppointmentStatus` now **return** `{ error }`
instead of throwing. A doctor meeting the billing gate is an ordinary event that
deserves a message, not an error page; their two calling components surface it.

---

## 6. Verification

### Static
```
npm run type-check   ✓
npm run lint         ✓
npm run build        ✓  28 routes + middleware
```

### Isolation and behaviour — 106/106

`npm run verify:isolation`, using real authenticated sessions across two clinics.
Phases 1–3 regress in full on every run.

| Group | Tests | Result |
|---|---|---|
| Phases 1–3 regression | 62 | ✅ |
| Billing services are ADMIN-managed | 5 | ✅ |
| Invoices and payments are DOCTOR/FRONT_DESK | 8 | ✅ |
| Phase 4 cross-clinic isolation | 4 | ✅ |
| Billing integrity rules | 10 | ✅ |
| Notification log | 5 | ✅ |
| Invoice arithmetic | 10 | ✅ |
| Clinic suspension covers billing | 2 | ✅ |

Results worth noting:

- **ADMIN is refused `42501` on both invoice and payment inserts** — the
  separation of duties is in the database, not in hidden buttons.
- **Payments cannot be altered after the fact.** An UPDATE matches zero rows;
  there is no policy permitting it.
- **Nobody can forge a delivery record** — `notifications` has no INSERT policy
  at all, so even ADMIN is refused `42501`.
- **A discount with no reason is rejected with `23514`**, by the database.
- **The invoice line keeps the name it was billed under** after the service is
  renamed, and still links back for reporting — the Phase 3 snapshot property,
  repeated for billing.
- **Clinic suspension covers Phase 4 for free.** Both new checks passed without
  a line of policy written for it, because every policy resolves tenancy through
  `get_user_clinic_id()`.
- **Arithmetic is asserted against the pure function directly**, including that
  three lines of ₹0.10 against a ₹0.30 payment leave a balance of exactly zero
  rather than a float residue that would block `PAID`.

### Defects found and fixed during self-review

Two real bugs, both in the re-invoicing path, caught before the suite was
extended to cover them:

1. `consultationBillingBlocker` and `ConsultationBilling` used `maybeSingle()`
   on "the invoice for this consultation". A visit whose first bill was
   cancelled and re-raised has **two**, so the query would have errored on
   exactly the path the gate's own message tells the user to take.
2. `saveInvoice` refused to create a replacement after a cancellation, because
   it found the cancelled invoice and reported it as uneditable — a dead end.

Both now take the newest invoice, and a cancelled one is stepped over rather
than edited back to life. Two regression tests cover it.

### Application smoke test

| Route | Signed out |
|---|---|
| `/login` | 200 |
| `/billing`, `/billing/services`, `/billing/invoices/new`, `/billing/invoices/[id]` | 307 → `/login` |
| `/billing/invoices/[id]/print` | 307 → `/login` |
| `/billing/payments/[id]/receipt` | 307 → `/login` |

Both print routes redirecting matters: they render patient names and amounts.

### Not verified

The browser click-through, unchanged from earlier phases — nobody has driven the
screens. Specifically unproven: **the printed invoice and receipt layouts have
never been seen rendered**, and **no notification has ever been sent to a real
provider**, since the test clinic runs on placeholder credentials. The send path
is exercised only down to the point where it decides to skip. Checklist in
`docs/setup.md`.

---

## 7. Open items

Tracked in [`summary/open-items.md`](open-items.md). Phase 4 added two entries
and closed one.

---

## 8. Amendment — the consultation → billing handoff

**Date:** 2026-08-16, after Phase 4 was delivered
**Migration:** `0007_consultation_number.sql`

### What was asked

> *"Billing shall be linked to consultation once consultation is marked as
> complete, there should be button made visible. It will be redirected to
> Billing module (provide button) and also add reference of consultation which
> will be helpful on future tracking on invoices against consultation."*

### The conflict this exposed

As delivered, billing sat **inside** the consultation and unlocked while the
visit was in progress, because completing the consultation was gated on the
bill being paid. A button that only appears *after* completion cannot coexist
with that: billing would wait on completion, completion would wait on payment,
and nothing could ever close.

The resolution was to notice that the original instruction said **appointment**,
not consultation. Putting the gate where it was actually asked for makes both
requirements true at once.

### What changed

| Before | After |
|---|---|
| Billing gate on consultation completion | Gate on **appointment** completion |
| Completing a consultation auto-completed its appointment | It no longer does — the visit stays open until settled |
| Invoice editor embedded in the consultation page | Read-only summary + **Raise invoice** button |
| Billing unlocked while the visit was in progress | Button appears once the consultation is COMPLETED |
| Invoices referenced a consultation by UUID | `C-0001`, shown in the list, on screen, in print, and searchable |

Every payment rule survived untouched: mode of payment still mandatory, a
shortfall still leaves the invoice `PARTIALLY_PAID`, a 100% discount with a
written reason still needs no payment. The check simply runs one step later.

### Consultation references

`consultations.consultation_number` (`C-0001`, unique per clinic) is allocated
in application code by the same read-highest-and-retry approach as
`patient_number` and `invoice_number`. Migration 0007 backfills existing rows in
creation order per clinic, then makes the column `NOT NULL`, so no consultation
can exist without a reference.

A bare UUID was the problem worth fixing: `Consultation: 3f2a8c91-…` on a
printed invoice helps nobody at a counter.

The reference now appears on the consultations list, the consultation header,
the printed consultation letter, the billing list, the invoice page, the printed
invoice, and as a billing search term alongside patient and invoice numbers.

### Gate logic is now directly tested

`billingBlockerFor()` was extracted into `src/types/billing.ts` as a pure
function, with `consultationBillingBlocker()` reduced to fetching the invoice
and deferring to it. The suite asserts every branch and its wording — previously
the gate's behaviour was only reachable through a server action, so it was
covered by the manual checklist alone.

### Files touched

```
supabase/migrations/0007_consultation_number.sql   new
src/features/consultations/actions.ts              number allocation; gate and auto-complete removed
src/features/appointments/actions.ts               gate added to completion
src/features/billing/consultation-billing.ts       reduced to a fetch + delegate
src/types/billing.ts                               billingBlockerFor()
src/types/clinical.ts                              consultation_number
src/components/billing/ConsultationBilling.tsx     editor → summary + button
src/app/(dashboard)/billing/invoices/new/page.tsx  ?consultation= handoff
src/app/(dashboard)/billing/page.tsx               consultation column + search
src/app/(dashboard)/billing/invoices/[id]/page.tsx reference instead of "this consultation"
src/app/billing/invoices/[id]/print/page.tsx       reference in the printed header
src/app/(dashboard)/consultations/page.tsx         reference column
src/app/(dashboard)/consultations/[id]/page.tsx    reference chip
src/app/consultations/[id]/print/page.tsx          reference on the letter
```

---

## 9. References

- Phase 1 — [`summary/phase1_implementation.md`](phase1_implementation.md)
- Phase 2 — [`summary/phase2_implementation.md`](phase2_implementation.md)
- Phase 3 — [`summary/phase3_implementation.md`](phase3_implementation.md)
- Open items — [`summary/open-items.md`](open-items.md)
- Setup & verification — [`docs/setup.md`](../docs/setup.md)
