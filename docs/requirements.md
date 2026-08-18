# Functional Requirements & Features

## Application Overview

Medi-Track is a multi-tenant clinic management system supporting multiple clinics from a single Next.js application.

Each clinic has isolated:
- Users and profiles
- Patients and records
- Appointments and consultations
- Medicines and prescriptions
- Billing and payments
- Documents and audit logs
- Configuration (email, WhatsApp, timezone)

---

## Phase 1: Foundation, Multi-Tenancy & Clinic Users

### Features
- Shared login page for all roles (single entry point)
- Supabase Auth integration
- Clinic creation and management (SUPER_ADMIN)
- Automatic ADMIN provisioning per clinic
- Clinic configuration management (Resend, WhatsApp, timezone)
- Role-based user creation (ADMIN creates clinic staff)
- Role-based navigation shell
- Multi-tenant RLS enforcement

### Clinic Configuration
`clinic_config` stores per-clinic settings:
- Resend API key (for email)
- Resend sender email
- WhatsApp API URL
- WhatsApp access token
- WhatsApp phone number ID
- WhatsApp business account ID
- Timezone
- Active status

Auto-generated with dummy/placeholder values when clinic is created.
ADMIN can view and update with real credentials.

### Demo Workflow (Phase 1)
```
SUPER_ADMIN creates clinic
  ↓
Clinic config auto-generated with dummy values
  ↓
ADMIN auto-provisioned
  ↓
ADMIN logs in via /login
  ↓
ADMIN views clinic config dashboard
  ↓
ADMIN creates Doctor and Front Desk users
  ↓
All users correctly scoped to clinic
```

---

## Phase 2: Patients, Doctors & Appointments

### Patient Management
- Patient CRUD operations
- Patient search functionality
- Patient history tracking (audit trail of changes)
- Clinic-scoped patients (unique `clinic_id + patient_number`)

### Doctor/Optometrist Management
- Doctor profile creation
- Specialty assignment
- Availability scheduling (day/time slots)

### Appointment Scheduling
- Schedule appointments (patient + doctor + time)
- Reschedule appointments
- Cancel appointments
- Check-in functionality
- Status lifecycle: `SCHEDULED → IN_PROGRESS → COMPLETED/CANCELLED/NO_SHOW/RESCHEDULED`
- Conflict detection (no double-booking)
- Clinic/patient/doctor ownership validation (server-side)

### Demo Workflow (Phase 2)
```
Front Desk registers patient
  ↓
Front Desk books appointment with doctor
  ↓
Reschedule/cancel/conflict rules enforced server-side
  ↓
Appointment confirmed
```

---

## Phase 3: Clinical Workflow, Medicines & Printing

### Consultation Module
- Consultation page (`/consultations/[id]`)
- Clinic-facing reference per visit (`C260818001`, unique per clinic) — cited by
  any invoice raised from the visit, and printed on both documents
- Conditional sections based on role/specialty
- Chief complaint and symptoms
- Patient history display
- Doctor notes and diagnosis
- Follow-up date and notes
- Consultation status: `DRAFT → IN_PROGRESS → COMPLETED/CANCELLED`

### Medicine Master
- Clinic-owned medicine catalog
- Create medicine (ADMIN)
- Update medicine details
- Deactivate medicine (soft delete; `is_active = false`)
- Never hard-delete (preserves historical prescriptions)
- Doctor can search and select medicines

### Prescription Module
- One prescription per consultation (multiple medicines)
- Medicine snapshot (stores medicine name at time of prescription)
- Dosage, frequency, duration, instructions per medicine
- Prescription status: `ACTIVE → COMPLETED/CANCELLED`
- Prevents inactive medicines from being selected for new prescriptions

### Optical Power Module
- Conditional display (when doctor/clinic authorized)
- Record optical measurements:
  - Right eye: SPH, CYL, AXIS
  - Left eye: SPH, CYL, AXIS
  - Pupil distance (PD)
- Optical power history view
- Used by optometrists and ophthalmologists

### Printing
- Consultation letter print page (`/consultations/[id]/print`)
- Print-friendly format with:
  - Clinic information (logo, name, address, contact)
  - Patient information
  - Consultation details
  - Optical power (when applicable)
  - Prescription
  - Doctor information and signature area
  - Follow-up date
- Uses `window.print()` + `@media print` CSS
- No PDF service required

### Demo Workflow (Phase 3)
```
Doctor opens consultation
  ↓
Records diagnosis/notes
  ↓
Adds optical power (when applicable)
  ↓
Selects medicines for prescription
  ↓
Saves consultation
  ↓
Generates consultation letter
  ↓
Prints letter
```

---

## Phase 4: Billing & Notifications

### Billing Services Master
- Clinic-owned chargeable services
- Examples: Consultation, Follow-up, Eye Examination, Other Services
- ADMIN can create/update/deactivate services
- `is_active` flag (never hard-delete referenced by historical invoices)

### Invoice Management
- Create invoices (from consultation or standalone)
- Invoice number (`INV260818001`, unique within clinic: `unique(clinic_id, invoice_number)`)
- Invoice items (services rendered with pricing) — quantity and unit price are
  captured and stored, but shown as a single amount per line (Phase 4.2)
- Server-calculated totals: subtotal, tax, discount, total, paid amount, balance
- Invoice status: `DRAFT → ISSUED → PARTIALLY_PAID/PAID → CANCELLED/VOID`
- Payment history
- Outstanding balance tracking

### Payment Recording
- Record payments against invoices
- Payment methods: `CASH, CARD, UPI, BANK_TRANSFER, OTHER`
- Payment date and reference number
- Server-side rules:
  - Payment cannot exceed outstanding balance (unless overpayment policy)
  - Cancelled/void invoices cannot receive new payments
  - Totals calculated server-side (never trust client)
  - Balance calculated server-side

### Printing
- Invoice print page (`/billing/invoices/[id]/print`)
- Receipt print page (`/billing/payments/[id]/receipt`)
- Print-friendly format
- Uses `window.print()` + `@media print` CSS

### Billing Search & History
- Search by patient, invoice number, date range, payment status
- Patient billing history in patient profile
- Clinic-scoped results (RLS enforced)

### Notifications
- Centralized Notification Service (server-only)
- Integrations:
  - Email via Resend
  - WhatsApp via Business API
- Events:
  - `APPOINTMENT_CREATED`
  - `APPOINTMENT_RESCHEDULED`
  - `APPOINTMENT_CANCELLED`
  - `APPOINTMENT_REMINDER`
  - `CONSULTATION_COMPLETED`
  - `PRESCRIPTION_ISSUED`
  - `INVOICE_CREATED`
  - `PAYMENT_RECEIVED`
  - `OTHER`
- Clinic-specific configuration (reads from `clinic_config`)
- Fallback: Gracefully handle missing/invalid credentials
- Notification log table: `notifications` tracks all outbound messages with status

### Consultation → Billing handoff

Billing is reached from the consultation, not performed inside it:

```
Doctor completes the consultation      (clinical sign-off, never gated)
  ↓
"Raise invoice" button appears on the consultation
  ↓
Billing module, with patient and consultation prefilled
  ↓
Lines added · discount with reason · invoice issued
  ↓
Payment and mode recorded
  ↓
Appointment can be marked COMPLETE     (gated here)
```

The gate sits on the **appointment**, not the consultation: completing the
consultation is what reveals the billing button, so gating that would make the
bill impossible to raise. Completing a consultation therefore does not complete
its appointment — the visit stays open until the patient has settled.

Every invoice raised this way stores `consultation_id` and displays the visit's
`C260818001` reference in the billing list, on the invoice page, on the printed
invoice, and as a search term.

### Demo Workflow (Phase 4)
```
Consultation completed
  ↓
Billing button appears → invoice raised against that consultation
  ↓
Appointment creates email + WhatsApp notification
  ↓
Payment recorded
  ↓
Receipt printed
  ↓
Appointment marked complete (refused until the bill is settled)
  ↓
Notifications logged in database with delivery status
```

---

## Phase 5: Documents, Audit & Production Readiness

### Medical Documents
- Upload documents to private Supabase Storage bucket
- Document types: Lab reports, eye reports, scanned prescriptions, etc.
- `medical_documents` table tracks:
  - Document type
  - File name
  - Storage path
  - Upload date/time
  - Uploaded by
- Access control: Authorized access only (no public URLs)
- Soft delete: `is_active = false` (never hard-delete)

### Audit Logging
- Comprehensive audit trail for key actions
- `audit_logs` table tracks:
  - Action type: `CREATE, READ, UPDATE, DELETE, LOGIN, CONFIG_CHANGE`
  - Entity type and ID
  - User who performed action
  - Changes (JSON diff)
  - Timestamp
  - IP address and user agent
  - Status and error messages
- Excludes full medical content (privacy)
- Clinic-scoped (RLS enforced)

### Security Testing
- Full multi-tenant RLS review
- Explicit cross-tenant attack testing:
  - Clinic A attempting to access Clinic B patients
  - Clinic A attempting to access Clinic B appointments
  - Clinic A attempting to access Clinic B consultations
  - Clinic A attempting to access Clinic B documents
  - Clinic A attempting to access Clinic B medicines
  - Clinic A attempting to access Clinic B invoices
  - Clinic A attempting to access Clinic B payments
  - Clinic A attempting to create records in Clinic B
- Every unauthorized attempt must fail
- Role/tenant authorization test pass across all modules
- Error handling verification
- Performance checks

### Production Deployment
- Vercel preview deployments working
- Vercel production deployment live
- Definition of Done checklist verified for every feature
- All environment variables configured
- Secrets not exposed
- Database backups configured (Supabase)

### Demo Workflow (Phase 5)
```
Security test suite executes
  ↓
Cross-clinic access tests fail (as expected)
  ↓
RLS policies verified working
  ↓
All features tested across all roles
  ↓
Deployment to production
  ↓
Live on Vercel with full security
```

---

## Primary End-to-End Workflow

Complete user journey from clinic creation to patient billing:

```
SUPER_ADMIN
  ↓
Create Clinic
  ↓
Clinic ADMIN automatically created
  ↓
ADMIN logs in through same /login
  ↓
ADMIN creates:
  - Doctor
  - Optometrist
  - Staff
  - Front Desk
  - Manages Medicines
  ↓
Front Desk logs in
  ↓
Registers Patient
  ↓
Schedules Appointment
  ↓
WhatsApp + Email notifications sent
  (using clinic-specific config)
  ↓
Patient Arrives
  ↓
Doctor logs in
  ↓
Opens Consultation
  ↓
Records:
  - Patient History
  - Doctor Notes
  - Optical Power (when applicable)
  - Diagnosis
  ↓
Selects Consulted Medicines
  ↓
Creates Prescription
  ↓
Saves Consultation
  ↓
Generates Consultation Letter
  ↓
Prints Letter
  ↓
Invoice Created
  ↓
Payment Recorded
  ↓
Receipt Printed
  ↓
Patient can later view:
  - Authorized records
  - Consultation history
  - Prescriptions
  - Billing status
```

---

## Billing Flow Details

### Manual Payment Processing
No online payment gateway in MVP.
Supports cash-at-counter, card swipe, UPI, bank transfer.

### Outstanding Balance Rules
- Balance = Total - Paid Amount
- No payment allowed above outstanding balance (unless policy override)
- Cancelled/void invoices cannot receive payments
- Multiple payments can be recorded against one invoice

### Example Flow
```
Invoice Total:      ₹1,500
Payment 1:          ₹1,000
Balance:            ₹500
Status:             PARTIALLY_PAID

Payment 2:          ₹500
Balance:            ₹0
Status:             PAID
```

### Invoice Lifecycle
- `DRAFT`: Being prepared, not finalized
- `ISSUED`: Finalized and presented to patient
- `PARTIALLY_PAID`: Some payment received
- `PAID`: Full payment received
- `CANCELLED`: Reversed invoice
- `VOID`: Cancelled for correction purposes

---

## Testing Strategy

### Authentication
- Shared login works for all roles
- Inactive users cannot access application
- Clinic user cannot switch clinic

### Multi-Tenancy (tested every phase)
- Clinic A cannot access Clinic B data
- ADMIN A cannot create users in Clinic B
- Doctor A cannot access unauthorized Clinic B patients
- Front Desk A cannot modify Clinic B appointments
- Patient A cannot access Patient B records
- SUPER_ADMIN platform operations work as designed

### Appointment Workflow
- Create appointment
- Reschedule appointment
- Cancel appointment
- Conflict detection
- Correct clinic ownership

### Consultation Workflow
- Create consultation
- Update consultation
- Add doctor notes
- Add medicines
- Add optical power
- Generate print view

### Medicine Management
- Create medicine
- Update medicine
- Deactivate medicine
- Select active medicine for prescription
- Prevent inactive medicine from new prescriptions

### Notifications
- Appointment created → notification sent
- Appointment changed → notification sent
- Appointment cancelled → notification sent
- Correct clinic/patient recipient

### Billing
- Create billing service
- Update/deactivate service
- Create invoice
- Correct invoice totals
- Record cash/card/UPI/bank payment
- Prevent payment above outstanding balance
- Update invoice status correctly
- Cancel/void invoice rules
- Print invoice
- Print receipt
- Clinic A cannot access Clinic B invoices or payments

---

## Definition of Done

A feature is complete only when:

### UI Implementation
- Responsive across mobile/tablet/desktop
- Follows [development-rules.md](./development-rules.md) guidelines
- Loading state exists
- Empty state exists
- Error state exists
- Dark mode works

### Functionality
- Server-side validation implemented
- Role authorization implemented
- Tenant authorization implemented
- Business logic correct

### Security
- Supabase RLS policies tested
- Cross-clinic access blocked
- No secrets exposed in logs/UI
- Server authorization separate from UI navigation

### Testing
- Unit tests for critical logic
- Multi-tenant isolation verified
- Role authorization verified
- Cross-clinic attempts fail
- Happy path workflow tested

### Code Quality
- TypeScript strict mode
- No `any` types
- Components follow guidelines
- No hardcoded colors/values (use theme)

### Database
- Database changes in explicit migrations
- Historical records remain intact

### Vercel Deployment
- Continues to work after changes
- No console errors or warnings

---

## Non-Negotiable Security Requirements

1. Never trust `clinic_id` from client → Always from authenticated user's profile
2. Always check authorization server-side → Never rely on UI routing
3. Use RLS on all queries → Supabase RLS is second line of defense
4. No hardcoded values → Everything through configuration
5. Responsive by default → Mobile-first approach
6. Accessibility → WCAG 2.1 AA minimum
7. No secrets in code → All via environment variables
8. TypeScript strict → Full type safety
9. Vercel compatible → Nothing that breaks serverless
10. Historical data preserved → Soft deletes only, never hard-delete
