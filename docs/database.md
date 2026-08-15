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
- `patient_number` (VARCHAR) — clinic-facing reference (`P-0001`), allocated in
  application code. Unique **per clinic**, so two clinics may both hold a `P-0001`.
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
- `appointment_id` (UUID, FK → appointments, UNIQUE, **NULLABLE**) — NULL for a
  walk-in consultation with no prior booking. Postgres treats NULLs as distinct
  under a UNIQUE constraint, so many walk-ins coexist while a booked appointment
  still maps to at most one consultation.
- `patient_id` (UUID, FK → patients)
- `doctor_id` (UUID, FK → profiles)
- `consultation_date` (DATE)
- `status` (consultation_status, default: 'DRAFT')
- `chief_complaint` (TEXT)
- `patient_history` (TEXT)
- `examination_findings` (TEXT)
- `diagnosis` (TEXT)
- `treatment_plan` (TEXT)
- `follow_up_date` (DATE)
- `follow_up_notes` (TEXT)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)
- `updated_by` (UUID)

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
- `price` (DECIMAL)
- `is_active` (BOOLEAN, default: TRUE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (UUID)
- `updated_by` (UUID)

**invoices**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `patient_id` (UUID, FK → patients)
- `consultation_id` (UUID, FK → consultations, ON DELETE SET NULL)
- `invoice_number` (VARCHAR)
- `invoice_date` (DATE)
- `due_date` (DATE)
- `status` (invoice_status, default: 'DRAFT')
- `subtotal` (DECIMAL)
- `tax_amount` (DECIMAL, default: 0)
- `discount_amount` (DECIMAL, default: 0)
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

**invoice_items**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `invoice_id` (UUID, FK → invoices)
- `description` (VARCHAR)
- `quantity` (INTEGER, default: 1)
- `unit_price` (DECIMAL)
- `amount` (DECIMAL)
- `created_at` (TIMESTAMP)

**payments**
- `id` (UUID, PK)
- `clinic_id` (UUID, FK → clinics)
- `invoice_id` (UUID, FK → invoices)
- `payment_date` (DATE)
- `amount` (DECIMAL)
- `method` (payment_method)
- `reference_number` (VARCHAR)
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `created_by` (UUID)

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
- `sent_at` (TIMESTAMP, default: CURRENT_TIMESTAMP)
- `delivery_status` (VARCHAR, default: 'PENDING')
- `error_message` (TEXT)
- `created_at` (TIMESTAMP)

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
  SELECT clinic_id FROM profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;
```

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

Each phase adds its own migration rather than editing an applied one. Phase 2–5
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
