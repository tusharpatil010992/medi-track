# Medi-Track — 5-Phase Delivery Plan

## Context

[Mark1.md](Mark1.md) is the full architecture/requirements spec for a multi-tenant clinic
management app (Next.js + TypeScript + MUI + Supabase + Resend + WhatsApp, deployed to Vercel).
Section 50 of that spec already breaks the work into 15 granular phases. The working directory is
currently empty (no code yet — greenfield project), so this plan consolidates those 15 phases into
5 larger delivery milestones that are easier to scope, sequence, and demo, while preserving the
original ordering/dependencies and the non-negotiable rules from the spec (never trust client-supplied
`clinic_id`, RLS mandatory, no PDF/worker services, historical data preserved via `is_active` not
hard-delete, etc.).

Each phase below ends in something demoable and is a strict prerequisite for the next (e.g. billing
needs consultations, consultations need patients/appointments, everything needs tenant/auth foundation).

---

## Phase 1 — Foundation, Multi-Tenancy & Clinic Users
*(spec Phases 1–3)*

### Database Schema & Configuration

**Universal Database Config**
- Single `db/config.ts` file (environment-agnostic) with:
  - Supabase URL and API keys from environment
  - Connection pool settings (min/max, timeouts)
  - Query timeout configuration
  - RLS enforcement flag
  - Environment detection and logging level
  - Validation function to ensure all required vars are set
- `.env.local` for development, `.env.production` for production (both use same `config.ts`)
- All tables include `clinic_id` for tenant isolation; see `plan/schema.sql` for complete schema

**Tables Created**
- `clinics` (id, name, email, phone, address, timezone, is_active, created_at, updated_at, created_by, updated_by)
- `clinic_config` (clinic_id → clinics, resend_api_key, resend_sender_email, whatsapp_api_url, whatsapp_access_token, whatsapp_phone_number_id, whatsapp_business_account_id, timezone, is_active)
- `profiles` (id → auth.users, clinic_id, email, full_name, phone, avatar_url, role, license_number, specialty, is_active, created_at, updated_at, created_by, updated_by)
  - Role enum: SUPER_ADMIN, ADMIN, DOCTOR, OPTOMETRIST, STAFF, FRONT_DESK, PATIENT
  - Unique constraint: (clinic_id, email)
- RLS policies: all tables enforce `clinic_id = current_user.clinic_id`; SUPER_ADMIN can see all clinics
- No database triggers; application code handles `updated_at` and audit logging (simpler, more controllable)

**Core Features**
- `clinic_config` auto-generated with dummy/placeholder values on clinic creation (resend_api_key='dummy_resend_key', etc.)
- `clinic_config` is auto-generated with dummy/placeholder values when a new clinic is created
- ADMIN can view and update clinic configuration (non-production values can be replaced with real credentials)
- Supabase RLS policies enforcing `record.clinic_id = current user's clinic_id`

### Application Features

- Scaffold Next.js + TypeScript + MUI + Supabase + Vercel
- Shared `/login` page + Supabase Auth integration (single login for all roles)
- SUPER_ADMIN: create/view/activate/deactivate clinics, auto-provision Clinic ADMIN on clinic creation, view/manage clinic configurations
- ADMIN dashboard: create Doctor/Optometrist/Staff/Front Desk (server always sets `clinic_id` from the logged-in admin, never from the client), activate/deactivate users, view/update own clinic's configuration
- Role-based navigation shell (UI-only; server authorization is the real boundary)
- Configuration access page (ADMIN only) to view and update clinic-specific Resend/WhatsApp settings

**Demo:** SUPER_ADMIN creates a clinic → clinic config auto-generated with dummy values → ADMIN auto-provisioned → ADMIN logs in via same `/login` → views clinic config dashboard → creates a Doctor and Front Desk user, each correctly scoped to that clinic.

## Phase 2 — Patients, Doctors & Appointments
*(spec Phases 4–6)*

- Patient CRUD, patient search, `patient_history` (all clinic-scoped, `unique(clinic_id, patient_number)`)
- Doctor profile, specialty, availability
- Appointment scheduling: create/reschedule/cancel/check-in, status lifecycle (SCHEDULED → ... → COMPLETED/CANCELLED/NO_SHOW), conflict detection, clinic/patient/doctor ownership validation

**Demo:** Front Desk registers a patient and books an appointment with a doctor; reschedule/cancel/conflict rules enforced server-side.

## Phase 3 — Clinical Workflow: Consultations, Medicines & Printing
*(spec Phases 7–11)*

- Consultation page (`/consultations/[id]`) with conditional sections (patient history, doctor notes, diagnosis, follow-up)
- Medicine master CRUD (clinic-owned, `is_active` deactivation, never hard-delete)
- Prescriptions: `prescriptions` + `prescription_items` with `medicine_name_snapshot` for historical accuracy
- Optical Power module (conditional on doctor/clinic config), `optical_power` table + history view
- Consultation letter / prescription print page (`/consultations/[id]/print`) using `window.print()` + `@media print` — no PDF service

**Demo:** Doctor opens a consultation, records diagnosis/notes, adds optical power (when applicable) and a prescription, saves, then prints a consultation letter.

## Phase 4 — Billing & Notifications
*(spec Phases 12–13)*

- Billing services master (clinic-owned, `is_active` for deactivation)
- Invoice creation + `invoice_items`, server-calculated totals/balance, payment recording (CASH/CARD/UPI/BANK_TRANSFER/OTHER), status lifecycle (DRAFT → ... → PAID/CANCELLED/VOID), no payment above outstanding balance, no gateway integration
- Invoice/receipt print pages, billing search/history, billing RLS + tenant isolation
- Centralized Notification Service (server-only) wrapping Resend (email) and WhatsApp Business API; `notifications` log table; appointment created/rescheduled/cancelled/reminder events
  - Notification Service reads clinic-specific Resend/WhatsApp config from `clinic_config` table for each clinic
  - Notifications only sent if clinic config is properly configured (not dummy values); fall back gracefully if credentials are missing/invalid
  - `notifications` log table tracks all outbound notifications per clinic with clinic_id enforcement

**Demo:** Consultation completion creates an invoice, payment is recorded and receipt printed; booking an appointment triggers an email + WhatsApp notification (using clinic-specific config) logged in `notifications`.

## Phase 5 — Documents, Audit & Production Readiness
*(spec Phases 14–15)*

- Medical documents via private Supabase Storage bucket (`medical_documents` table, authorized access only, no public URLs)
- Audit logging for key actions (`audit_logs`), excluding full medical content
- Full multi-tenant RLS review + explicit cross-tenant attack testing (Clinic A attempting to reach Clinic B's patients/appointments/consultations/documents/medicines/invoices/payments — every attempt must fail)
- Role/tenant authorization test pass across all modules, error handling, performance checks
- Production deployment to Vercel; verify Definition of Done checklist (§52) for every shipped feature

**Demo:** Security test suite proving cross-clinic access is impossible for every entity type; production deployment live on Vercel.

---

## Database Setup

**Initial Schema Application**
- All schema defined in `plan/schema.sql` (single source of truth)
- Apply to Supabase via SQL Editor: copy `plan/schema.sql` → paste in Supabase SQL Editor → Run
- Schema includes: all tables from all 5 phases, enums, indexes, RLS policies, triggers for automatic timestamps, audit function
- RLS enabled on all tables by default; enforces `clinic_id = current_user.clinic_id` via helper function `get_user_clinic_id()`

**Configuration**
- Create `.env.local` (development) or `.env.production` (production) with:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
  DB_POOL_MIN=2
  DB_POOL_MAX=20
  DB_IDLE_TIMEOUT=30000
  DB_QUERY_TIMEOUT=30000
  ENFORCE_RLS=true
  ```
- Create `db/config.ts` (universal config file) that reads these env vars and validates them on startup
- No environment-specific config files; `config.ts` works identically across dev/staging/production

## Verification

- Each phase should end with the corresponding "Testing Strategy" checks from spec §47 passing (unit/integration tests for that module) before moving to the next phase.
- Multi-tenancy checks (spec §48) should be re-run at the end of every phase, not just Phase 5, since each phase adds new clinic-owned tables.
- **Database Config Validation:** On app startup, call `validateDbConfig()` to ensure all required env vars are set; log validation errors to console.
- **Clinic Config Isolation:** Verify that ADMIN A cannot view or update ADMIN B's clinic configuration; RLS policies must prevent cross-clinic config access; SUPER_ADMIN can view all clinic configs but operations must be audit-logged.
- **RLS Testing:** Use Supabase SQL editor to test as different clinic users; verify that `SELECT * FROM patients` returns only current clinic's patients, never other clinics' data.
- Use `window.print()` output and Supabase RLS policy tests (e.g. via Supabase SQL editor or a test harness hitting the DB as different users) to confirm isolation, since these can't be fully verified by TypeScript types alone.
- Final acceptance: walk the full end-to-end workflow in spec §51 (SUPER_ADMIN → clinic → ADMIN auto-provisioned with config → ADMIN updates config → staff creation → patient → appointment → consultation → prescription → billing → notifications with clinic-specific config) manually in a deployed Vercel preview.
