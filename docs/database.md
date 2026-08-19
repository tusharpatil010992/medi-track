# Database Design & Configuration

## Overview

PostgreSQL database via Supabase with Row Level Security (RLS) for multi-tenant isolation.

**Key Principles:**
- Single schema for all clinics
- Clinic isolation via `clinic_id` column on all clinic-owned tables
- RLS policies enforce tenant boundaries at database level
- Soft deletes only (use `is_active` flag)
- Historical data preserved (never hard-delete)
- No database triggers (application handles `updated_at` and audit logging)

---

## Database Configuration

### Universal Config File

Create single `db/config.ts` for all environments:

```typescript
export const dbConfig = {
  // Supabase credentials from environment
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Connection pool settings
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  },

  // Query timeout
  queryTimeoutMs: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),

  // Environment
  environment: process.env.NODE_ENV,

  // RLS enforcement
  enforceRLS: process.env.ENFORCE_RLS !== 'false',

  // Logging
  enableQueryLogging: process.env.DB_LOG_QUERIES === 'true',
};
```

### Environment Variables

Set in `.env.local` (development) or `.env.production` (production):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
DB_QUERY_TIMEOUT=30000

# Configuration
NODE_ENV=development
ENFORCE_RLS=true
DB_LOG_QUERIES=false
```

---

## Schema Overview

### Type Enums

```sql
user_role:
  - SUPER_ADMIN
  - ADMIN
  - DOCTOR
  - OPTOMETRIST
  - STAFF
  - FRONT_DESK
  - PATIENT

appointment_status:
  - SCHEDULED      booked, not yet acknowledged
  - CONFIRMED      patient confirmed attendance
  - CHECKED_IN     arrived at the desk
  - IN_PROGRESS    with the clinician
  - COMPLETED      consultation finished
  - CANCELLED      called off
  - NO_SHOW        did not arrive
  - RESCHEDULED    superseded by a replacement booking

consultation_status:
  - DRAFT
  - IN_PROGRESS
  - COMPLETED
  - CANCELLED

prescription_status:
  - ACTIVE
  - COMPLETED
  - CANCELLED

invoice_status:
  - DRAFT
  - ISSUED
  - PAID
  - PARTIALLY_PAID
  - CANCELLED
  - VOID

payment_method:
  - CASH
  - CARD
  - UPI
  - BANK_TRANSFER
  - OTHER

notification_type:
  - APPOINTMENT_CREATED
  - APPOINTMENT_RESCHEDULED
  - APPOINTMENT_CANCELLED
  - APPOINTMENT_REMINDER
  - CONSULTATION_COMPLETED
  - PRESCRIPTION_ISSUED
  - INVOICE_CREATED
  - PAYMENT_RECEIVED
  - OTHER

notification_channel:
  - EMAIL
  - WHATSAPP
  - SMS

audit_action:
  - CREATE
  - READ
  - UPDATE
  - DELETE
  - LOGIN
  - CONFIG_CHANGE
```

---

## Table Structure

### Phase 1: Foundation & Multi-Tenancy

**clinics**
- `id` (UUID, PK)
- `name` (VARCHAR)
- `letterhead_gap_percent` (NUMERIC, default 12.0, 0–50) — blank space reserved
  at the top of printed letters, as a percentage of A4 page height, so content
  clears pre-printed letterhead. 0 disables it. **Lives here, not on
  `clinic_config`:** DOCTORs print the letters, and `clinic_config` is
  ADMIN-only because it stores credentials. This is presentation config, not a
  secret, so it belongs on a table every clinic member can read.
- `email` (VARCHAR)
- `phone` (VARCHAR)
- `address` (TEXT)
- `city`, `state`, `postal_code`, `country` (VARCHAR)
- `timezone` (VARCHAR, default: 'UTC')
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)
- `updated_by` (UUID)

**clinic_config**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics, UNIQUE)
- `resend_api_key` (VARCHAR, default: 'dummy_resend_key')
- `resend_sender_email` (VARCHAR, default: 'noreply@dummy.com')
- `whatsapp_api_url` (VARCHAR, default: dummy URL)
- `whatsapp_access_token` (VARCHAR, default: dummy token)
- `whatsapp_phone_number_id` (VARCHAR, default: dummy)
- `whatsapp_business_account_id` (VARCHAR, default: dummy)
- `timezone` (VARCHAR)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `updated_by` (UUID)

**profiles**
- `id` (UUID, PK, FK → auth.users)
- `clinic_id` (UUID, FK → clinics, **NULLABLE**) — NULL for SUPER_ADMIN, which is
  platform-level and belongs to no clinic. A `CHECK` constraint enforces the pairing:
  SUPER_ADMIN must have NULL, every other role must have a clinic.
  Note that `clinic_id = get_user_clinic_id()` is therefore never true for
  SUPER_ADMIN, since `NULL = NULL` evaluates to NULL — policies must test
  `is_super_admin()` separately, and `id = auth.uid()` must come first so any
  user can always load their own profile.
- `email` (VARCHAR)
- `full_name` (VARCHAR)
- `phone` (VARCHAR)
- `avatar_url` (VARCHAR)
- `role` (user_role)
- `license_number` (VARCHAR)
- `specialty` (VARCHAR)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)
- `updated_by` (UUID)
- UNIQUE(`clinic_id`, `email`)

### Phase 2: Patients & Appointments

**patients**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `patient_number` (VARCHAR) — clinic-facing reference (`P260818001`), allocated
  in application code. Unique **per clinic**, so two clinics may both hold a
  `P260818001`. See [Reference numbering](#reference-numbering).
- `first_name` (VARCHAR, NOT NULL)
- `last_name` (VARCHAR, NOT NULL)
- `email` (VARCHAR)
- `phone` (VARCHAR)
- `date_of_birth` (DATE)
- `gender` (VARCHAR)
- `blood_group` (VARCHAR)
- `address`, `city`, `state`, `postal_code`, `country` (TEXT/VARCHAR)
- `emergency_contact_name` (VARCHAR)
- `emergency_contact_phone` (VARCHAR)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)
- `updated_by` (UUID)
- UNIQUE(`clinic_id`, `patient_number`)

**patient_history**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `patient_id` (UUID, FK → patients)
- `change_type` (VARCHAR)
- `previous_data` (JSONB)
- `new_data` (JSONB)
- `changed_at` (TIMESTAMP)
- `changed_by` (UUID)

**doctor_availability**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `doctor_id` (UUID, FK → profiles)
- `day_of_week` (INTEGER, 0-6)
- `start_time` (TIME)
- `end_time` (TIME)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)

**appointments**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `patient_id` (UUID, FK → patients)
- `doctor_id` (UUID, FK → profiles)
- `appointment_date` (DATE)
- `appointment_time` (TIME)
- `duration_minutes` (INTEGER, default: 30)
- `status` (appointment_status, default: 'SCHEDULED')
- `notes` (TEXT)
- `reason_for_visit` (VARCHAR)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)
- `updated_by` (UUID)

### Phase 3: Consultations, Medicines & Printing

**consultations**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `consultation_number` (VARCHAR, NOT NULL) — clinic-facing reference
  (`C260818001`), allocated in application code. Unique **per clinic**, so two
  clinics may both hold a `C260818001`. Added in migration 0007 so an invoice can
  cite the visit it came from in a form a human can act on: the bare UUID is
  useless on a printed bill. Printed on both the consultation letter and the
  invoice, and searchable from the billing list. See
  [Reference numbering](#reference-numbering).
- UNIQUE(`clinic_id`, `consultation_number`)
- `appointment_id` (UUID, FK → appointments, UNIQUE, **NULLABLE**) — NULL for a
  walk-in consultation with no prior booking. Postgres treats NULLs as distinct
  under a UNIQUE constraint, so many walk-ins coexist while a booked appointment
  still maps to at most one consultation.
- `patient_id` (UUID, FK → patients)
- `doctor_id` (UUID, FK → profiles)
- `consultation_date` (DATE)
- `status` (consultation_status, default: 'DRAFT')
- `chief_complaint` (TEXT) — **RESERVED**, see below
- `patient_history` (TEXT) — **RESERVED**, see below
- `examination_findings` (TEXT) — **RESERVED**, see below
- `diagnosis` (TEXT) — **RESERVED**, see below
- `treatment_plan` (TEXT) — **RESERVED**, see below
- `follow_up_date` (DATE)
- `follow_up_notes` (TEXT)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)
- `updated_by` (UUID)

> **The five RESERVED columns.** Phase 4.3 replaced them with
> `consultation_notes`, where a clinic defines its own fields instead of
> inheriting these. Migration 0008 **cleared their data** and nothing in the
> application reads or writes them. They are kept on the table rather than
> dropped in case a fixed shape is wanted again — a `COMMENT ON COLUMN` marks
> each one in the database itself. See
> [Phase 4.3](#phase-43-clinic-defined-consultation-notes).

**medicines**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `name` (VARCHAR)
- `generic_name` (VARCHAR)
- `strength` (VARCHAR)
- `unit` (VARCHAR)
- `dosage_form` (VARCHAR)
- `manufacturer` (VARCHAR)
- `cost_price` (DECIMAL)
- `selling_price` (DECIMAL)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)
- `updated_by` (UUID)

**prescriptions**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `consultation_id` (UUID, FK → consultations)
- `patient_id` (UUID, FK → patients)
- `doctor_id` (UUID, FK → profiles)
- `prescription_date` (DATE)
- `status` (prescription_status, default: 'ACTIVE')
- `notes` (TEXT)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)
- `updated_by` (UUID)

**prescription_items**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `prescription_id` (UUID, FK → prescriptions)
- `medicine_id` (UUID, FK → medicines, ON DELETE SET NULL)
- `medicine_name_snapshot` (VARCHAR) - Store name at time of prescription
- `dosage` (VARCHAR)
- `frequency` (VARCHAR)
- `duration` (VARCHAR)
- `quantity` (INTEGER)
- `instructions` (TEXT)
- `created_at` (TIMESTAMP)

**optical_power**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `consultation_id` (UUID, FK → consultations)
- `patient_id` (UUID, FK → patients)
- `date_recorded` (DATE)
- `right_eye_sph` (DECIMAL)
- `right_eye_cyl` (DECIMAL)
- `right_eye_axis` (INTEGER, 0–180)
- `right_eye_add` (DECIMAL) — near-vision addition
- `left_eye_sph` (DECIMAL)
- `left_eye_cyl` (DECIMAL)
- `left_eye_axis` (INTEGER, 0–180)
- `left_eye_add` (DECIMAL)
- `pupil_distance` (DECIMAL)

The two ADD columns come from `plan/Mark1.md` §25 and were missing here.
Without them a reading or bifocal prescription cannot be recorded, which rules
out most patients with presbyopia.
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)

### Phase 4: Billing & Notifications

**billing_services**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `name` (VARCHAR)
- `description` (TEXT)
- `price` (DECIMAL, CHECK ≥ 0)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)
- `updated_by` (UUID)

`plan/Mark1.md` §744 sketches this table with `default_amount` and `tax_rate`
instead. The `price` shape above is what shipped, matching `plan/schema.sql`;
tax is held once per invoice rather than per service.

**invoices**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `patient_id` (UUID, FK → patients)
- `consultation_id` (UUID, FK → consultations, ON DELETE SET NULL)
- `invoice_number` (VARCHAR) — clinic-facing reference (`INV260818001`),
  allocated in application code. See [Reference numbering](#reference-numbering).
- `invoice_date` (DATE)
- `due_date` (DATE)
- `status` (invoice_status, default: 'DRAFT')
- `subtotal` (DECIMAL)
- `tax_amount` (DECIMAL, default: 0)
- `discount_amount` (DECIMAL, default: 0)
- `discount_reason` (TEXT) — **why** the discount was given, in free text
- `total_amount` (DECIMAL)
- `paid_amount` (DECIMAL, default: 0)
- `balance_amount` (DECIMAL)
- `notes` (TEXT)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)
- `updated_by` (UUID)
- UNIQUE(`clinic_id`, `invoice_number`)
- CHECK `discount_amount = 0 OR discount_reason IS NOT NULL`

`discount_reason` was added in Phase 4 on instruction: a reduced or waived
charge must always carry a written justification, and the CHECK makes that
unskippable rather than merely a rule in the form. It is what makes a 100%
"family visit" waiver auditable — and it is the mechanism that lets a zero-total
invoice satisfy the completion gate with no payment row at all.

Every monetary column is written by the server from recomputed values.
`computeInvoiceTotals()` in `src/types/billing.ts` is the only place the
arithmetic lives; client-submitted totals are ignored.

**invoice_items**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `invoice_id` (UUID, FK → invoices)
- `service_id` (UUID, FK → billing_services, ON DELETE SET NULL)
- `description` (VARCHAR) — the service's name at the moment it was billed
- `quantity` (INTEGER, default: 1, CHECK > 0)
- `unit_price` (DECIMAL)
- `amount` (DECIMAL)
- `created_at` (TIMESTAMP)

`service_id` was added in Phase 4 alongside `description`, mirroring
`prescription_items.medicine_id` + `medicine_name_snapshot`: the description is
the snapshot and must never change when the price list is edited, while the FK
preserves the link needed to report revenue by service.

`quantity` and `unit_price` are still captured and still stored — the invoice
editor asks for both, and `amount` remains `quantity × unit_price`. **Phase 4.2
stopped displaying them**, on screen and on the printed invoice: a line now
reads as its description and its amount. The breakdown is retained in the
database for reporting and audit, so nothing was lost, and any future decision
to show it again is a display change with no data migration behind it.

**payments**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `invoice_id` (UUID, FK → invoices)
- `payment_date` (DATE)
- `amount` (DECIMAL, CHECK > 0)
- `method` (payment_method)
- `reference_number` (VARCHAR)
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `created_by` (UUID)

One row per tender, not per invoice: a patient settling ₹1,500 as ₹1,000 cash
plus ₹500 card produces two rows, which is why the method lives here.

Payments are **immutable**. There is no UPDATE or DELETE policy — money received
is a historical fact, and an invoice raised in error is cancelled rather than
having its ledger rewritten.

**notifications**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `recipient_email` (VARCHAR)
- `recipient_phone` (VARCHAR)
- `notification_type` (notification_type)
- `channel` (notification_channel)
- `subject` (VARCHAR)
- `body` (TEXT)
- `related_entity_type` (VARCHAR)
- `related_entity_id` (UUID)
- `provider_message_id` (VARCHAR) — the id Resend or WhatsApp returned
- `sent_at` (TIMESTAMP, default: CURRENT_TIMESTAMP)
- `delivery_status` (VARCHAR, default: 'PENDING')
- `error_message` (TEXT)
- `created_at` (TIMESTAMP)

`provider_message_id` was added in Phase 4: without it a `SENT` row cannot be
traced back to the provider when a patient reports a message never arrived.

`delivery_status` carries a fourth value beyond the documented
PENDING/SENT/FAILED — **SKIPPED**, meaning the clinic is still on placeholder
credentials so nothing was attempted. Recording those as FAILED would bury the
real failures under noise.

### Phase 4.3: Clinic-defined consultation notes

**consultation_note_types** — the dropdown a doctor picks from
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `name` (VARCHAR(100))
- `display_order` (INTEGER, default: 0)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` / `updated_at` (TIMESTAMP)
- `created_by` / `updated_by` (UUID)
- UNIQUE(`clinic_id`, `name`)

Clinic-owned master data, like `medicines` and `billing_services`, but writable
by **DOCTOR as well as ADMIN**: the clinicians filling the fields in are the
ones who know what the clinic should be recording. Every clinic is seeded with
the five labels the consultation form used to hard-code — by migration 0008 for
clinics that already existed, and by `createClinic()` for new ones.

**consultation_notes** — one row per note on a visit
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `consultation_id` (UUID, FK → consultations)
- `patient_id` (UUID, FK → patients) — denormalised, so reading a patient's
  notes across visits needs no join
- `note_type_id` (UUID, FK → consultation_note_types, ON DELETE SET NULL)
- `note_type_snapshot` (VARCHAR(100)) — the field label at the time of writing
- `content` (TEXT)
- `show_on_receipt` (BOOLEAN, default: FALSE) — prints on the consultation letter
- `display_order` (INTEGER, default: 0)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` / `updated_at` (TIMESTAMP)
- `created_by` / `updated_by` (UUID)

`note_type_snapshot` repeats the property `prescription_items.medicine_name_
snapshot` and `invoice_items.description` already carry: renaming "Diagnosis"
in the master must never rewrite a letter already handed to a patient. The FK
stays alongside it so notes can still be counted by field.

**Neither table has a DELETE policy.** Removing a note from the form sets
`is_active = FALSE`; nothing in the application destroys clinical text. This is
deliberately unlike `prescription_items`, which is replaced wholesale on save —
so `saveConsultationNotes()` reconciles rows by id (update, insert, deactivate)
rather than deleting and reinserting.

### Phase 5: Documents, Audit & Security

**medical_documents**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `patient_id` (UUID, FK → patients)
- `document_type` (VARCHAR)
- `file_name` (VARCHAR)
- `file_size` (INTEGER)
- `file_path` (VARCHAR)
- `storage_url` (VARCHAR)
- `uploaded_at` (TIMESTAMP)
- `uploaded_by` (UUID)
- `is_active` (BOOLEAN, default: TRUE)

**audit_logs**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `action` (audit_action)
- `entity_type` (VARCHAR)
- `entity_id` (UUID)
- `user_id` (UUID)
- `changes` (JSONB) - JSON diff of old → new
- `ip_address` (VARCHAR)
- `user_agent` (TEXT)
- `status` (VARCHAR, default: 'SUCCESS')
- `error_message` (TEXT)
- `created_at` (TIMESTAMP)

---

## Reference numbering

Three tables carry a human-facing reference alongside their UUID, because a UUID
is useless on a printed letter or bill:

| Table | Column | Example |
|---|---|---|
| `patients` | `patient_number` | `P260818001` |
| `consultations` | `consultation_number` | `C260818001` |
| `invoices` | `invoice_number` | `INV260818001` |

A reference is its prefix, a `YYMMDD` stamp, then a sequence that **restarts at
001 each day**. All three are allocated in application code — there is no
sequence, default or trigger in the database (Rule 5). `src/lib/reference-numbers.ts`
holds the format; each of the three server actions holds its own query.

**Uniqueness is per clinic, not global.** Two clinics may both hold a
`P260818001`. The daily restart is safe precisely because the date is inside the
value, so `UNIQUE(clinic_id, ...)` still holds.

**The stamp is `YYMMDD`, not `DDMMYY`, so that sorting these columns as text
gives chronological order.** The billing list depends on that for its
`invoice_date` then `invoice_number` sort, and it is what lets an allocator
scope a query to a single day with a prefix match.

**Allocation reads the day, then takes the numeric maximum.** Not the
lexicographic one: past 999 a clinic's sequence widens to four digits, and
`"1000"` sorts below `"999"` as text. Read-then-insert races are settled the
way they always were — by the UNIQUE constraint and a retry on `23505`.

**The date is UTC**, matching `consultation_date` and `invoice_date`, which are
already stamped from the server clock. The reference always agrees with the date
on its own row. `clinics.timezone` is deliberately not consulted: for IST
(UTC+5:30) the two diverge only between 00:00 and 05:30 local, when no clinic is
open. A clinic **west** of UTC would see an evening visit carry the next day's
stamp — at that point derive the date from `clinics.timezone` and use it for the
two date columns as well, so they do not drift apart.

**Superseded references are left as issued.** Rows created before Phase 4.1 keep
`P-0001`, `C-0001`, `INV-0001` — they are printed on documents already in
patients' hands, and an invoice number is a financial record. No backfill was
run and none should be. They never match a daily prefix, so allocation ignores
them, and they sort before every dated reference under both `C` and `en_US`
collations, which is chronologically correct since they are all older.

---

## Indexes

All tables have indexes on:
- `clinic_id` (for RLS policy filtering)
- Foreign key columns (for joins)
- Frequently filtered columns (`status`, `is_active`, dates)
- Unique columns

Example indexes:
```sql
CREATE INDEX idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX idx_patients_is_active ON patients(is_active);
CREATE INDEX idx_appointments_clinic_date ON appointments(clinic_id, appointment_date);
CREATE INDEX idx_invoices_status ON invoices(status);
```

---

## Row Level Security (RLS)

### RLS Enabled on All Tables
Every clinic-owned table has RLS enabled by default.

### RLS Helper Functions

**`SECURITY DEFINER` is mandatory on every helper that reads `profiles`.**

These functions are called from policies that are themselves ON `profiles`. A
plain function re-enters the policy that invoked it and Postgres aborts the
query with `infinite recursion detected in policy for relation "profiles"` —
which blocks every read, including login. `SECURITY DEFINER` runs the function
as its owner, bypassing RLS and breaking the cycle. `SET search_path` is pinned
so the definer context cannot be hijacked via a mutable search path.

```sql
CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS UUID
LANGUAGE SQL STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.clinic_id
  FROM profiles p
  JOIN clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.is_active = TRUE
    AND c.is_active = TRUE;
$$;
```

The join on `clinics` is what makes clinic deactivation real — see
[Clinic deactivation](#clinic-deactivation) below.

`current_user_role()` and `is_super_admin()` follow the same shape. Inlining
`(SELECT role FROM profiles WHERE id = auth.uid())` directly into a policy
causes the same recursion — always go through a definer function.

### Base Policy Pattern

Clinic-owned tables enforce isolation on both read and write:

```sql
CREATE POLICY clinic_isolation_policy ON [table_name]
  FOR ALL TO authenticated
  USING      (clinic_id = get_user_clinic_id())
  WITH CHECK (clinic_id = get_user_clinic_id());
```

**`WITH CHECK` is not optional.** `USING` filters which existing rows are
visible; it does not constrain rows being written. With `USING` alone, a clinic
user can `INSERT` a row stamped with another clinic's `clinic_id` — the row is
accepted, then becomes invisible to its author. Every policy permitting
`INSERT` or `UPDATE` must carry `WITH CHECK`.

Tables get no `DELETE` policy: records are deactivated via `is_active`.

### Role-scoped write policies

Read access is usually clinic-wide, but writes are narrowed by role. Phase 2
limits patient and appointment writes to FRONT_DESK and DOCTOR; ADMIN and
OPTOMETRIST read only:

```sql
CREATE POLICY patients_insert ON patients
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = get_user_clinic_id()
    AND current_user_role() IN ('FRONT_DESK', 'DOCTOR')
  );
```

`doctor_availability` narrows further to row ownership, so a doctor can only
publish their own schedule:

```sql
AND current_user_role() = 'DOCTOR' AND doctor_id = auth.uid()
```

Phase 3 continues the pattern: `consultations`, `prescriptions` and
`prescription_items` are DOCTOR-write; `medicines` is ADMIN-write and readable
only by ADMIN/DOCTOR/OPTOMETRIST; `optical_power` is writable by DOCTOR and
OPTOMETRIST.

Phase 4.3 adds the one master table that is **not** ADMIN-only:

| Table | SELECT | INSERT / UPDATE | DELETE |
|---|---|---|---|
| `consultation_note_types` | clinic-wide | ADMIN, **DOCTOR** | none |
| `consultation_notes` | clinic-wide | DOCTOR | none |

`consultation_note_types` is readable clinic-wide rather than restricted like
`medicines`, because these are field labels rather than clinical content, and
every role that can open a consultation needs them to render its notes.

### Billing: a separation of duties

Phase 4 splits billing so that the role setting prices is not the role taking
money:

| Table | SELECT | INSERT / UPDATE |
|---|---|---|
| `billing_services` | ADMIN, DOCTOR, FRONT_DESK | **ADMIN** |
| `invoices`, `invoice_items` | ADMIN, DOCTOR, FRONT_DESK | **DOCTOR, FRONT_DESK** |
| `payments` | ADMIN, DOCTOR, FRONT_DESK | **DOCTOR, FRONT_DESK** (insert only) |
| `notifications` | **ADMIN** | **nobody** |

ADMIN maintains the price list and can review every invoice, but cannot raise
one or record a payment. OPTOMETRIST and STAFF have no billing access at all.
This is enforced in the database, not by hiding buttons: the isolation suite
asserts ADMIN is refused with `42501` on both an invoice insert and a payment
insert.

`notifications` has **no INSERT policy whatsoever**, so no signed-in user can
forge or alter a delivery record. Rows are written only by the server-side
notification service. Read is ADMIN-only because the rows carry patients' names,
email addresses and phone numbers in plain text.

### Where the billing gate lives, and why not in RLS

A visit cannot be closed until the money is accounted for. That rule spans two
tables and depends on a *sum* of payments, which no `WITH CHECK` expression can
express usefully, so it is enforced in the server action rather than in a
policy:

| Layer | Enforces |
|---|---|
| RLS | Who may write invoices and payments at all |
| `setAppointmentStatus()` | The gate — bill issued, payment and mode recorded |

The gate runs when the **appointment** is completed, not the consultation.
Completing the consultation is what reveals the billing button, so gating that
would deadlock: the bill could never be raised in the first place. Completing a
consultation therefore no longer completes its appointment either — the visit
stays open until the patient has settled at the desk.

The decision itself is `billingBlockerFor()` in `src/types/billing.ts`, kept
pure and separate from the query that finds the invoice so its branches and
wording are directly asserted by the verification suite.

### Where the notification service bypasses RLS

`src/lib/notifications/dispatch.ts` reads `clinic_config` with the
**service-role key**, bypassing RLS. This is deliberate and worth understanding:

`clinic_config` is ADMIN-readable only, because it stores live Resend and
WhatsApp credentials. But the people who trigger notifications are FRONT_DESK
booking an appointment and DOCTOR taking a payment — neither can read it. Either
the credentials get exposed clinic-wide, or the send path runs above RLS. The
second is safer.

The tenancy that RLS would have applied is therefore applied by hand: every
query in that module filters on the `clinic_id` passed in, and that value always
originates from the caller's authenticated server-side profile — never from a
request body. Because RLS is bypassed there, those explicit filters are the only
boundary left, which is exactly the standing rule for
`createAdminClient()`.

### Clinic deactivation

SUPER_ADMIN can suspend a clinic by setting `clinics.is_active = FALSE`. Because
all 35 policies resolve tenancy through `get_user_clinic_id()`, and that
function now requires the clinic to be active, a suspended clinic returns NULL
there. `clinic_id = NULL` evaluates to NULL rather than TRUE, so **every**
clinic-scoped read and write yields zero rows — across every table, in every
phase, with no policy needing to know about it.

What suspension does and does not do:

| | |
|---|---|
| Blocks sign-in for every user in the clinic | Yes — **including that clinic's own ADMIN** |
| Applies to sessions already open | Yes, from the next request |
| Changes `profiles.is_active` for those users | **No** |
| Reversible by SUPER_ADMIN | Yes — `is_super_admin()` ignores clinic state |

That third row matters. Suspension gates on the clinic's flag rather than
flipping each user's own flag, so reactivating a clinic restores exactly the
users who were enabled before — anyone individually deactivated stays that way.

`current_user_clinic_is_active()` exists so the application can tell a suspended
clinic apart from an empty one and show a real message. Without it, a locked-out
user would simply see blank screens: once suspended, they can no longer read
even their own `clinics` row, since `clinics_select` also routes through
`get_user_clinic_id()`.

### Where a rule cannot live in RLS

The optical power section is meant to appear only for an ophthalmologist. That
test reads `profiles.specialty`, which is **free text** and cannot be matched
reliably inside a policy — a typo or a different wording would silently change
who is authorised.

So the rule is split deliberately:

| Layer | Enforces |
|---|---|
| RLS | Role — only DOCTOR and OPTOMETRIST may write `optical_power` at all |
| Server action + UI | Specialty — `recordsOpticalPower()` in `src/types/user.ts` |

RLS remains the outer boundary: it stops FRONT_DESK and every other clinic
outright. The specialty check narrows within that, and is a workflow
convenience rather than a security boundary. **ADMINs should know that the
`specialty` field drives this behaviour** — a doctor whose specialty does not
mention "ophthalm" will not see the section.

### Special Policies

**Profiles:** Users see profiles from their clinic; SUPER_ADMIN sees all
```sql
CREATE POLICY see_clinic_profiles ON profiles
  FOR SELECT
  USING (
    clinic_id = get_user_clinic_id() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'::user_role
  );
```

**Clinic Config:** ADMIN of that clinic + SUPER_ADMIN only — **not** all clinic users.

`clinic_config` stores live credentials (Resend API key, WhatsApp access
token). A clinic-wide read policy would expose those secrets to every
FRONT_DESK, DOCTOR and PATIENT in the clinic. Requirements state that ADMIN
manages this configuration, so the read is scoped to ADMIN.

```sql
CREATE POLICY clinic_config_select ON clinic_config
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (clinic_id = get_user_clinic_id() AND current_user_role() = 'ADMIN')
  );
```

Application code adds a second layer: the settings page never sends stored
secret values to the browser, only whether each field is still a placeholder.

**Clinics:** Users see their clinic; SUPER_ADMIN sees all
```sql
CREATE POLICY clinic_visibility ON clinics
  FOR SELECT
  USING (
    id = get_user_clinic_id() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'::user_role
  );
```

---

## Schema Application

### Step 1: Create Supabase Project
1. Go to supabase.com
2. Create new project
3. Save URL and API keys

### Step 2: Apply Schema

Migrations live in `supabase/migrations/`, applied in filename order via the
Supabase SQL Editor (paste and run) or `supabase db push`.

| Migration | Contents |
|---|---|
| `0001_phase1_foundation.sql` | `user_role` enum, `clinics`, `clinic_config`, `profiles`, RLS helper functions, RLS policies |
| `0002_phase2_patients_appointments.sql` | `appointment_status` enum, `patients`, `patient_history`, `doctor_availability`, `appointments`, RLS policies |
| `0003_phase3_clinical.sql` | `consultation_status` / `prescription_status` enums, `consultations`, `medicines`, `prescriptions`, `prescription_items`, `optical_power`, RLS policies |
| `0004_letterhead_gap.sql` | `clinics.letterhead_gap_percent` — per-clinic print offset for pre-printed letterhead |
| `0005_clinic_deactivation.sql` | Gates `get_user_clinic_id()` on clinic active state; adds `current_user_clinic_is_active()` |
| `0006_phase4_billing_notifications.sql` | `invoice_status` / `payment_method` / `notification_type` / `notification_channel` enums, `billing_services`, `invoices`, `invoice_items`, `payments`, `notifications`, RLS policies |
| `0007_consultation_number.sql` | `consultations.consultation_number` — clinic-facing visit reference, backfilled for existing rows then made mandatory |

Each phase adds its own migration rather than editing an applied one. Phase 5
tables documented above are not created until their phase ships.

### Step 2b: Seed the first SUPER_ADMIN

SUPER_ADMIN cannot be created through the UI — it is the account that creates
everything else. Create the auth user in Supabase (Authentication → Users → Add
user, with "Auto Confirm"), then run:

```sql
INSERT INTO profiles (id, clinic_id, email, full_name, role)
VALUES ('<auth-user-uuid>', NULL, '<email>', '<full name>', 'SUPER_ADMIN');
```

`clinic_id` must be NULL — the CHECK constraint rejects a SUPER_ADMIN with a clinic.

### Step 3: Verify
Run in SQL Editor to confirm tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

---

## Soft Deletes Only

### Rule
Never hard-delete clinic-owned records that are referenced by history.

### Implementation
Use `is_active = FALSE` instead:
```sql
-- Don't do this:
DELETE FROM medicines WHERE id = medicine_id;

-- Do this:
UPDATE medicines SET is_active = FALSE WHERE id = medicine_id;
```

### Benefits
- Historical data preserved
- No referential integrity breaks
- Can reactivate if needed
- Audit trail remains intact

---

## No Database Triggers

### Why?
- Simpler schema to understand
- Application controls logic explicitly
- Easier to debug
- More testable

### Application Responsibility
- Set `updated_at = NOW()` when updating records
- Log audit events when needed
- No automatic timestamps from database

### Example Update
```typescript
// Application code handles updated_at
const { data, error } = await supabase
  .from('patients')
  .update({
    name: newName,
    updated_at: new Date().toISOString(),
    updated_by: currentUserId,
  })
  .eq('id', patientId)
  .eq('clinic_id', clinicId);
```

---

## Multi-Tenant Query Patterns

### Always Include clinic_id

**Pattern 1: Filter by clinic_id**
```sql
SELECT * FROM patients 
WHERE clinic_id = $1 
AND id = $2;
```

**Pattern 2: Verify clinic ownership before operation**
```sql
-- Check user's clinic
SELECT clinic_id FROM profiles WHERE id = auth.uid();

-- Verify record belongs to same clinic
SELECT * FROM patients 
WHERE id = $1 
AND clinic_id = $2;  -- clinic_id from user's profile
```

**Pattern 3: Server-side clinic_id assignment**
```typescript
// Never accept clinic_id from request body
const clinicId = userProfile.clinic_id;  // From authenticated user

const { data } = await supabase
  .from('patients')
  .insert({
    clinic_id: clinicId,  // Server assigns
    name: request.body.name,
    // ... other fields
  });
```

---

## Connection Management

### Supabase Connection
```typescript
import { createClient } from '@supabase/supabase-js';
import { dbConfig } from '@/db/config';

const supabase = createClient(
  dbConfig.supabaseUrl,
  dbConfig.supabaseAnonKey
);
```

### Service Role Access (Server-Only)
```typescript
// Only in server-side code (API routes, Server Components)
const supabaseAdmin = createClient(
  dbConfig.supabaseUrl,
  dbConfig.supabaseServiceKey
);
```

### Query Timeouts
Respect `DB_QUERY_TIMEOUT` environment variable for long-running queries.

---

## Backup & Maintenance

### Backups
Supabase automatically maintains:
- Daily backups (free tier)
- Point-in-time recovery (paid tiers)

Configure backup retention in Supabase dashboard.

### Monitoring
- Monitor RLS policy performance
- Check index usage
- Monitor query performance
- Set up alerting for errors

### Optimization
- Ensure indexes on filtered columns
- Avoid N+1 queries (use JOIN)
- Use database functions for complex operations (optional)
