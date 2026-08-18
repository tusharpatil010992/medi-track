# Setup & Verification

How to bring Phase 1 up locally and prove that tenant isolation actually holds.

---

## 1. Install

```bash
npm install
```

## 2. Supabase project

Create a project at [supabase.com](https://supabase.com), then copy
Project Settings → API values into `.env.local`:

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. `.env.local` is gitignored and must stay that way —
the service-role key bypasses RLS entirely.

## 3. Apply the migrations

Supabase Dashboard → SQL Editor. Paste and run each file from
`supabase/migrations/` **in filename order**:

1. `0001_phase1_foundation.sql`
2. `0002_phase2_patients_appointments.sql`
3. `0003_phase3_clinical.sql`
4. `0004_letterhead_gap.sql`
5. `0005_clinic_deactivation.sql`
6. `0006_phase4_billing_notifications.sql`
7. `0007_consultation_number.sql`

Confirm they landed:

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
```

Expect `appointments`, `billing_services`, `clinics`, `clinic_config`,
`consultations`, `doctor_availability`, `invoices`, `invoice_items`,
`medicines`, `notifications`, `optical_power`, `patient_history`, `patients`,
`payments`, `prescription_items`, `prescriptions`, `profiles` — each with
`rowsecurity = true`.

## 4. Seed the first SUPER_ADMIN

This account cannot be created through the UI — it creates everything else.

1. Authentication → Users → **Add user**. Set an email and password, enable **Auto Confirm User**.
2. Copy the new user's UUID.
3. SQL Editor:

```sql
INSERT INTO profiles (id, clinic_id, email, full_name, role)
VALUES ('<uuid>', NULL, '<email>', 'Platform Admin', 'SUPER_ADMIN');
```

`clinic_id` must be NULL — the CHECK constraint rejects a SUPER_ADMIN with a clinic.

## 5. Run

```bash
npm run dev
```

Open http://localhost:3000 → redirects to `/login`.

---

## Phase 1 acceptance walkthrough

The Phase 1 demo flow from `docs/requirements.md`:

1. Sign in as SUPER_ADMIN → lands on `/dashboard`, sidebar shows **Dashboard** and **Clinics** only.
2. Clinics → **New clinic** → fill clinic name + administrator name/email → Create.
3. Temporary ADMIN credentials are shown **once**. Copy them.
4. Verify the clinic row appears with status **Active**.
5. Sign out. Sign in as the new ADMIN at the same `/login`.
6. Sidebar now shows **Dashboard**, **Users**, **Clinic Settings** — no Clinics link.
7. Clinic Settings → placeholders flagged with a warning → enter a real Resend key → Save → warning clears for that field.
8. Users → **New user** → create a Doctor and a Front Desk user. Credentials shown once each.
9. Sign in as the Doctor → sidebar shows Dashboard only.
10. Deactivate the Doctor from the ADMIN's Users page, then attempt to sign in as that Doctor → rejected with "This account is inactive".

---

## Multi-tenant isolation tests

**These are the tests that matter.** Passing type-checks proves nothing here —
isolation lives in RLS and in the server actions.

### Automated suite

```bash
npm run verify:isolation
```

`scripts/verify-isolation.mjs` provisions two clinics with a full set of roles,
signs each in for a **real authenticated session** (never the service-role key,
which bypasses RLS and would prove nothing), asserts the boundaries, then
removes every fixture it created.

It covers cross-clinic reads and writes, role write restrictions, availability
ownership, appointment integrity, per-clinic `patient_number` and
`invoice_number` uniqueness, the billing separation of duties, and the invoice
arithmetic itself.

Phase 4 checks are **skipped with a clear message** rather than failing
obscurely if migration 0006 has not been applied — a missing table reports as
`PGRST205`, which reads like a broken policy if you are not expecting it. A
missing migration 0007 stops the run outright at a preflight check, since every
consultation fixture depends on that column.

**Re-run it at the end of every phase**, not just the phase that added a table —
each new clinic-owned table inherits these policy patterns, so a regression in
one phase surfaces here.

### Manual checks

The suite does not drive the browser. These still warrant a click-through:

### Via the UI

| Attempt | Expected |
|---|---|
| ADMIN of A opens `/clinics` | Redirected to `/dashboard` — SUPER_ADMIN only |
| ADMIN of A opens `/settings` | Sees only clinic A's config |
| Doctor of A opens `/users` | Redirected to `/dashboard` — ADMIN only |
| Signed-out user opens `/dashboard` | Redirected to `/login` |
| ADMIN of A creates a user | New user's `clinic_id` is A, with no way to choose B |
| ADMIN opens `/patients` | Sees the list; no "Register patient" button |
| OPTOMETRIST opens `/patients/new` | Redirected to `/dashboard` |
| FRONT_DESK opens `/schedule` | Redirected to `/dashboard` — DOCTOR only |
| Book outside a doctor's availability | Rejected: "The doctor is not available at that time" |
| Book over an existing appointment | Rejected: "That slot overlaps an existing appointment" |
| FRONT_DESK opens `/consultations/new` | Redirected to `/dashboard` — DOCTOR only |
| DOCTOR opens `/medicines` | Redirected to `/dashboard` — ADMIN only |
| Doctor with specialty "Ophthalmology" opens a consultation | Optical power section is shown |
| Doctor with specialty "General Medicine" opens a consultation | Optical power section is hidden |
| Prescribe a deactivated medicine | Rejected: "… is deactivated and cannot be prescribed" |
| Complete a consultation, then edit it | Fields read-only; save refused |
| Open `/consultations/[id]/print` | Letter renders with no sidebar; browser print dialog is clean |
| SUPER_ADMIN deactivates a clinic, then its ADMIN signs in | Rejected: "This clinic is currently suspended" |
| A user of that clinic already signed in | Loses access on next request, redirected to `/login` |
| DOCTOR or FRONT_DESK opens `/billing/services` | Redirected to `/dashboard` — ADMIN only |
| ADMIN opens `/billing` | Sees every invoice, with a note that raising and collecting is not theirs |
| ADMIN opens an invoice | No Issue, Cancel or Record payment controls |
| OPTOMETRIST opens `/billing` | Redirected to `/dashboard` |
| Complete a consultation | Always allowed — clinical sign-off is not gated on billing |
| …and its appointment afterwards | Stays **In progress**; it is not auto-completed any more |
| Open a consultation still in progress | Billing card shows "Complete the consultation to raise the invoice" — no button |
| Complete the consultation | **Raise invoice** button appears on the billing card |
| Click Raise invoice | Lands on `/billing/invoices/new?consultation=…` with the patient and visit prefilled |
| Visit `/billing/invoices/new?consultation=…` for an open consultation | Refused with a link back to the consultation |
| Mark the appointment complete with no invoice | Refused: "Raise the invoice for this visit before completing it" |
| …with the invoice still a draft | Refused: "…still a draft. Issue it before completing the visit" |
| …with an issued but unpaid invoice | Refused: "Record the payment and its mode…" |
| Record a part payment, then complete the appointment | Allowed; invoice sits at **Partially paid** |
| Apply a 100% discount with a reason, issue, then complete the appointment | Allowed with no payment recorded |
| Search billing for a consultation reference (`C260818001`) | Returns the invoices raised from that consultation |
| Search billing for a date stamp (`260818`) | Returns everything referenced that day |
| Print an invoice raised from a consultation | Header carries `Consultation C260818001 · <date>` |
| Open an issued invoice, then print it | Items table shows **Description and Amount only** — no Qty or Unit price column, in either place |
| Edit a draft invoice | The editor still asks for Qty and Unit price; only the display dropped them |
| Apply a discount and leave the reason blank | Refused by the form *and* by the database CHECK |
| Record a payment larger than the balance | Refused: "That is more than the outstanding balance" |
| Split a bill across cash and card | Two payment rows; each prints its own receipt |
| Mark an appointment complete while its consultation is open | Refused: "The consultation for this visit is still open. Close it first." |
| Open `/billing/invoices/[id]/print` and `/billing/payments/[id]/receipt` | Render with no sidebar; letterhead gap matches the consultation letter |
| ADMIN opens Clinic Settings with placeholder credentials | Notification log shows recent messages as **Not configured** |
| ADMIN enters a real Resend key, then books an appointment | Log shows **Sent**; a bad key shows **Failed** with the provider's reason |
| SUPER_ADMIN reactivates the clinic | Access restored; individually disabled users stay disabled |

### Via SQL, as a real user

Application-layer checks can be bypassed; RLS cannot. Test the database directly.
In the SQL Editor, impersonate a clinic-A user:

```sql
-- Impersonate an authenticated request from a clinic A user
SET request.jwt.claims = '{"sub":"<clinic-A-user-uuid>","role":"authenticated"}';
SET ROLE authenticated;

-- Each of these MUST return zero rows
SELECT * FROM patients      WHERE clinic_id = '<clinic-B-id>';   -- Phase 2+
SELECT * FROM profiles      WHERE clinic_id = '<clinic-B-id>';
SELECT * FROM clinic_config WHERE clinic_id = '<clinic-B-id>';
SELECT * FROM clinics       WHERE id        = '<clinic-B-id>';

-- This MUST be rejected by the WITH CHECK clause
INSERT INTO profiles (id, clinic_id, email, full_name, role)
VALUES (gen_random_uuid(), '<clinic-B-id>', 'x@x.com', 'X', 'DOCTOR');

RESET ROLE;
```

### Secret exposure check

As a **non-ADMIN** clinic A user (e.g. the Doctor), this must return zero rows —
`clinic_config` holds the Resend key and WhatsApp token:

```sql
SELECT * FROM clinic_config;
```

---

## Checks that run without a database

```bash
npm run type-check   # TypeScript strict, no `any`
npm run lint         # ESLint
npm run build        # production build
```

These verify the code compiles and the routes build. They do **not** verify
authentication, authorisation or tenant isolation — only the tests above do.
