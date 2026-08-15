# Medical Records & Clinic Management Application

## AI-Friendly Multi-Tenant Architecture Specification

## 1. Project Objective

Build a secure, simple, multi-tenant medical records and clinic management application.

The system will support multiple clinics from a single Next.js application.

Each clinic will have its own isolated users, patients, appointments, consultations, medicines, prescriptions, billing records, documents, and operational data.

The application must remain:

- Easy to understand
- Easy to maintain
- Easy to test
- Easy to deploy to Vercel
- Easy to extend later
- Secure by default

Core modules:

- Authentication and shared login
- Multi-tenant clinic management
- Clinic user management
- Patient management
- Appointment scheduling
- Consultation and patient history
- Medicine master and prescriptions
- Optical power
- Consultation letter / prescription printing
- Billing and payments
- Medical documents
- Email and WhatsApp notifications
- Audit logging

---

# 2. Non-Negotiable Technology Stack

Use only:

- Next.js
- React
- TypeScript
- Material UI
- Supabase
- Resend
- WhatsApp Business API/provider
- Vercel

Do NOT introduce:

- Spring Boot
- Express
- NestJS
- Separate backend application
- Separate frontend application
- Microservices
- Docker requirement
- Custom Node server
- Dedicated persistent worker server

Next.js is responsible for:

- UI
- Server Components
- Client Components
- Server Actions
- Route Handlers
- Authentication integration
- Authorization checks
- Business logic
- Notification orchestration

Supabase is responsible for:

- PostgreSQL database
- Authentication
- Row Level Security
- File Storage

Vercel is responsible for:

- Next.js hosting
- CI/CD deployment
- Preview deployments
- Production deployment
- Scheduled jobs where appropriate

Resend is responsible for email.

WhatsApp Business API/provider is responsible for WhatsApp notifications.

---

# 3. Multi-Tenant Principle

The clinic is the primary tenant and security boundary.

Every clinic-owned record must contain a `clinic_id` either directly or through a parent entity whose ownership is enforced.

Examples:

- Patient belongs to a clinic
- Doctor belongs to a clinic
- Staff belongs to a clinic
- Appointment belongs to a clinic
- Consultation belongs to a clinic
- Medicine belongs to a clinic unless explicitly configured as a global medicine master
- Prescription belongs to a clinic
- Documents belong to a clinic
- Notifications belong to a clinic

A user must never be able to access another clinic's data.

The only exception is `SUPER_ADMIN`, which is a platform-level role and can manage tenants according to the application's authorization rules.

Do not rely on URL parameters, hidden UI elements, or client-side `clinic_id` values for tenant security.

Tenant isolation must be enforced server-side and with Supabase RLS.

---

# 4. User Roles

## SUPER_ADMIN

Platform-level user.

Can:

- Create clinics
- View clinics
- Activate/deactivate clinics
- Manage clinic-level configuration where required
- View clinic status
- Create or regenerate the initial clinic ADMIN account
- Manage platform-level settings

SUPER_ADMIN is not automatically a member of every clinic.

Platform access must be explicitly recognized by role and server-side authorization.

Avoid giving SUPER_ADMIN unrestricted access to medical data unless that is an explicit business requirement.

---

## ADMIN

Clinic-level administrator.

An ADMIN belongs to exactly one clinic in the initial design.

When a new clinic is created, the application automatically provisions an ADMIN account for that clinic.

ADMIN can:

- Manage clinic profile
- Manage clinic users
- Create Doctor accounts
- Create Staff accounts
- Create Optometrist accounts
- Create Front Desk accounts
- Manage clinic-level settings
- Manage clinic medicines
- View clinic operational information

ADMIN should not automatically be allowed to modify clinical records unless explicitly required.

---

## DOCTOR

Clinic-level clinical user.

Can:

- View authorized clinic patients
- View patient history
- Conduct consultations
- Add diagnosis
- Add doctor notes
- Add consulted medicines
- Create prescriptions
- View previous consultations according to clinic policy
- Print consultation letters
- Record optical information when authorized

---

## OPTOMETRIST

Clinic-level clinical user.

Can:

- View authorized patients
- Record optical power
- Update optical power where allowed
- View optical power history
- Participate in consultation workflows according to clinic configuration

---

## STAFF

Clinic-level user.

Permissions should be configurable later.

Initially allow only the operational features required by the clinic.

Do not give clinical write permissions by default.

---

## FRONT_DESK

Clinic-level operational user.

Can:

- Register patients
- Edit patient demographic information
- Search patients belonging to the clinic
- Schedule appointments
- Reschedule appointments
- Cancel appointments
- Check in patients
- View appointment history

Cannot by default:

- Modify doctor notes
- Modify consultations
- Prescribe medicines
- Modify optical power

Front Desk may also perform billing operations if the clinic enables billing permissions.

---

## BILLING PERMISSIONS

Billing should be permission-based within the clinic.

ADMIN can:

- Create/update billing services
- Configure clinic charges
- Create invoices
- Record payments
- View billing reports
- Cancel or void invoices according to clinic policy

FRONT_DESK can, when enabled:

- Create invoices
- Record payments
- Print receipts
- View patient billing history

DOCTOR can:

- View billing status for the current consultation where required
- Do not allow billing master-data changes by default

PATIENT can:

- View their own invoices
- View payment status
- View/print their own receipts where enabled

---

## PATIENT

Patient access is restricted to their own records.

Can:

- View own profile
- View own appointments
- View own consultation history where permitted
- View prescriptions
- View consultation letters
- View permitted documents
- Receive email notifications
- Receive WhatsApp notifications

A patient must never access another patient's information.

---

# 5. Shared Login Page

There must be a single login page for all users.

Example:

`/login`

Do NOT create separate login pages for:

- Super Admin
- Clinic Admin
- Doctor
- Optometrist
- Staff
- Front Desk
- Patient

All users authenticate through the same login flow.

After authentication:

```text
Login
  |
  v
Supabase Auth
  |
  v
Load application profile
  |
  +---- SUPER_ADMIN
  |
  +---- ADMIN
  |
  +---- DOCTOR
  |
  +---- OPTOMETRIST
  |
  +---- STAFF
  |
  +---- FRONT_DESK
  |
  +---- PATIENT
  |
  v
Resolve clinic context
  |
  v
Authorize
  |
  v
Redirect to role-appropriate dashboard
```

The authenticated user's clinic must be derived from trusted server-side profile data.

Never trust a `clinic_id` supplied by the browser.

---

# 6. Clinic Provisioning Flow

When SUPER_ADMIN creates a new clinic:

```text
SUPER_ADMIN
    |
    v
Create Clinic
    |
    v
Create Clinic ADMIN account
    |
    v
Assign ADMIN to Clinic
    |
    v
Send initial access information
```

The process should be transactional from the application's perspective.

Suggested clinic fields:

```text
clinics
- id
- name
- code
- email
- phone
- address
- logo_url
- timezone
- status
- created_at
- updated_at
```

Status could initially be:

```text
ACTIVE
INACTIVE
SUSPENDED
```

The clinic code must be unique.

---

# 7. Clinic ADMIN Provisioning

When a clinic is created, automatically create its first ADMIN account.

Recommended model:

```text
clinics
   |
   +---- users/profile
          |
          +---- role = ADMIN
          +---- clinic_id = clinic.id
```

The ADMIN must belong to exactly one clinic.

Do not allow an ADMIN to select or switch to another clinic from the client UI.

A SUPER_ADMIN may manage the clinic and its ADMIN according to platform rules.

---

# 8. Clinic ADMIN User Management

The clinic ADMIN can create:

- Doctor
- Optometrist
- Staff
- Front Desk

Each created user must automatically receive:

```text
clinic_id = loggedInAdmin.clinic_id
```

This assignment must happen on the server.

Never accept an arbitrary clinic ID from the browser when ADMIN is creating a user.

Example:

```text
Clinic A ADMIN
       |
       +---- Doctor A
       +---- Doctor B
       +---- Optometrist A
       +---- Staff A
       +---- Front Desk A
```

All belong to Clinic A.

---

# 9. User Profile Model

Use Supabase Auth for authentication and a separate application profile table for authorization metadata.

Suggested structure:

```text
profiles
- id
- clinic_id
- role
- first_name
- last_name
- email
- phone
- is_active
- created_at
- updated_at
```

`id` should correspond to the authenticated Supabase user ID.

For `SUPER_ADMIN`, `clinic_id` can be null in the initial model because this is a platform-level user.

For clinic users, `clinic_id` is required.

---

# 10. Role + Tenant Authorization

Authorization should be based on both:

```text
user.role
+
user.clinic_id
```

Example:

```text
ADMIN + Clinic A
```

can manage Clinic A.

It cannot manage Clinic B.

Example:

```text
DOCTOR + Clinic A
```

can access only records authorized within Clinic A.

Example:

```text
PATIENT + Clinic A
```

can access only the patient's own records.

Example:

```text
SUPER_ADMIN
```

can access platform-level clinic administration.

---

# 11. Tenant Security Rule

Every clinic query must be tenant-aware.

Bad approach:

```text
select * from patients where id = patientId
```

Preferred security model:

```text
select patient
where patient.id = patientId
and patient.clinic_id = currentUser.clinicId
```

Even better, use Supabase RLS so the database itself enforces the tenant boundary.

Never depend only on application code.

---

# 12. Recommended Data Model

Core platform tables:

```text
clinics
profiles
```

Clinic operational tables:

```text
patients
doctors / clinical profiles
doctor_availability
appointments
consultations
patient_history
medicines
prescriptions
prescription_items
optical_power
medical_documents
notifications
billing_services
invoices
invoice_items
payments
audit_logs
```

All clinic-owned entities need tenant ownership.

---

# 13. Patient Model

Suggested fields:

```text
patients
- id
- clinic_id
- patient_number
- first_name
- last_name
- date_of_birth
- gender
- phone
- email
- address
- emergency_contact
- created_at
- updated_at
```

The patient number can be unique within a clinic.

Do not assume it must be globally unique unless the business requires it.

Recommended database uniqueness concept:

```text
unique(clinic_id, patient_number)
```

---

# 14. Patient History

Create a dedicated patient history section.

Possible initial fields:

```text
patient_history
- id
- patient_id
- clinic_id
- allergies
- existing_conditions
- previous_surgeries
- current_medications
- family_history
- other_notes
- updated_by
- created_at
- updated_at
```

The exact clinical fields should remain configurable as requirements evolve.

Patient history must be clinic-scoped.

---

# 15. Appointment Module

Suggested fields:

```text
appointments
- id
- clinic_id
- patient_id
- doctor_id
- appointment_date
- start_time
- end_time
- status
- reason
- notes
- created_by
- created_at
- updated_at
```

Statuses:

```text
SCHEDULED
CONFIRMED
CHECKED_IN
IN_PROGRESS
COMPLETED
CANCELLED
NO_SHOW
```

Appointment creation must validate:

- Clinic ownership
- Patient belongs to clinic
- Doctor belongs to clinic
- Doctor availability
- Time conflict
- Appointment date/time

---

# 16. Billing Module

The billing module manages charges raised by the clinic and payments received from patients.

The initial implementation should focus on simple clinic billing and should NOT require an online payment gateway.

## Billing Goals

Support:

- Consultation charges
- Other clinic services
- Invoice generation
- Payment recording
- Receipt printing
- Outstanding amount tracking
- Patient billing history

## Billing Flow

```text
Patient
   |
   v
Appointment / Consultation
   |
   v
Create Invoice
   |
   +---- Consultation Fee
   +---- Other Services
   |
   v
Record Payment
   |
   v
Receipt
```

## Billing Services Master

ADMIN can maintain clinic-specific chargeable services.

Example services:

```text
Consultation
Follow-up Consultation
Optometry Consultation
Eye Examination
Other Clinic Service
```

Suggested fields:

```text
billing_services
- id
- clinic_id
- name
- description
- default_amount
- tax_rate
- is_active
- created_at
- updated_at
```

Use `is_active` instead of hard deleting services already referenced by historical invoices.

## Invoice

Suggested fields:

```text
invoices
- id
- clinic_id
- patient_id
- appointment_id
- consultation_id
- invoice_number
- invoice_date
- subtotal
- discount_amount
- tax_amount
- total_amount
- amount_paid
- balance_amount
- status
- notes
- created_by
- created_at
- updated_at
```

Invoice status:

```text
DRAFT
ISSUED
PARTIALLY_PAID
PAID
CANCELLED
VOID
```

The invoice number should be unique within a clinic.

Recommended uniqueness concept:

```text
unique(clinic_id, invoice_number)
```

## Invoice Items

Use separate invoice items so one invoice can contain multiple services.

```text
invoice_items
- id
- invoice_id
- service_id
- service_name_snapshot
- quantity
- unit_price
- discount_amount
- tax_amount
- line_total
- created_at
```

Store the service name snapshot and price on the invoice item so historical invoices do not change when the billing service master is modified later.

## Payments

A payment is a separate record.

```text
payments
- id
- clinic_id
- invoice_id
- patient_id
- amount
- payment_method
- payment_reference
- payment_date
- notes
- received_by
- created_at
```

Initial payment methods:

```text
CASH
CARD
UPI
BANK_TRANSFER
OTHER
```

Do not implement payment gateway integration in the initial MVP.

## Payment Rules

The server must ensure:

- Payment belongs to the same clinic as the invoice
- Payment cannot exceed outstanding balance unless an explicit overpayment policy exists
- Cancelled/void invoices cannot receive new payments
- Invoice total is calculated server-side
- Balance is calculated server-side
- Client-submitted totals must not be trusted

Example:

```text
Invoice Total     ₹1,500
Payment           ₹1,000
------------------------
Balance             ₹500
Status         PARTIALLY_PAID
```

After another ₹500 payment:

```text
Invoice Total     ₹1,500
Total Paid        ₹1,500
Balance               ₹0
Status              PAID
```

## Billing and Consultation

The consultation workflow may create or link an invoice.

Example:

```text
Consultation completed
        |
        v
Consultation charge
        |
        v
Invoice created
        |
        v
Payment recorded
```

Do not hard-code billing logic inside the consultation React component.

Use a billing service/action on the server.

## Billing UI

Recommended screens:

```text
/billing
/billing/invoices
/billing/invoices/[id]
/billing/services
```

Invoice page should show:

- Patient
- Appointment
- Consultation
- Invoice number
- Invoice date
- Line items
- Subtotal
- Discount
- Tax
- Total
- Paid amount
- Balance
- Payment history
- Status

Actions:

```text
Create Invoice
Record Payment
Print Invoice
Print Receipt
Cancel Invoice
```

## Billing Search and History

Allow authorized clinic users to search billing records by:

- Patient
- Invoice number
- Date range
- Payment status

Patient profile should include a billing history section showing only that patient's clinic-scoped records.

## Billing Print

Use a protected, print-friendly Next.js page.

Examples:

```text
/billing/invoices/[id]/print
/billing/payments/[id]/receipt
```

Use browser printing initially with `window.print()` and `@media print`.

Do not introduce a PDF-generation service unless a later requirement needs downloadable PDF files.

---

# 18. Consultation Module

The consultation page is the central clinical workflow.

Suggested page:

`/consultations/[id]`

Layout:

```text
--------------------------------------------------
Patient Header
--------------------------------------------------
Patient Name
Patient ID
Age
Gender
Appointment
Doctor

--------------------------------------------------
Patient History
--------------------------------------------------
Allergies
Existing Conditions
Previous Surgeries
Current Medication
Other History

--------------------------------------------------
Consultation
--------------------------------------------------
Chief Complaint
Symptoms
Diagnosis
Doctor Note
Follow-up Date

--------------------------------------------------
Optical Power
--------------------------------------------------
Shown when applicable

--------------------------------------------------
Consulted Medicines
--------------------------------------------------
Medicine
Dosage
Frequency
Duration
Instructions

--------------------------------------------------
Actions
--------------------------------------------------
Save Consultation
Generate Consultation Letter
Print
```

---

# 18. Consultation Model

Suggested fields:

```text
consultations
- id
- clinic_id
- appointment_id
- patient_id
- doctor_id
- consultation_date
- chief_complaint
- symptoms
- diagnosis
- doctor_note
- follow_up_date
- created_at
- updated_at
```

A consultation must belong to the same clinic as its appointment, patient, and doctor.

The server must validate these relationships.

---

# 19. Doctor Note

Doctor Note is clinical free-form text.

Example:

```text
Patient reports irritation in both eyes for three days.
No significant redness.
Continue current medication.
Review after two weeks.
```

Only authorized clinical users should be able to create/update it.

Front Desk should not be able to modify it by default.

---

# 20. Medicine Master CRUD

Medicine management is a clinic-level master-data module.

ADMIN:

- Create medicine
- Read medicine
- Update medicine
- Deactivate medicine

DOCTOR:

- Read medicines
- Select medicines during consultation

OPTOMETRIST:

- Read medicines only if the clinic configuration allows prescribing

FRONT_DESK:

- No medicine-management access by default

---

# 21. Clinic Medicines vs Global Medicines

For the initial version, medicines should be clinic-owned.

```text
medicines
- id
- clinic_id
- name
- generic_name
- form
- strength
- unit
- description
- instructions
- is_active
- created_at
- updated_at
```

This means Clinic A can have its own medicine list independent of Clinic B.

A future global medicine catalog can be introduced later without changing the consultation workflow significantly.

---

# 22. Do Not Hard Delete Medicines

If a medicine has historical prescriptions, do not physically delete it.

Use:

```text
is_active = false
```

Inactive medicines cannot be selected for new prescriptions but remain visible in historical consultations.

---

# 23. Consulted Medicines / Prescription

A consultation may have one prescription containing multiple medicines.

Recommended model:

```text
prescriptions
- id
- clinic_id
- consultation_id
- patient_id
- doctor_id
- prescription_date
- created_at
```

```text
prescription_items
- id
- clinic_id
- prescription_id
- medicine_id
- medicine_name_snapshot
- dosage
- frequency
- duration
- instructions
- created_at
```

Store `medicine_name_snapshot` so old prescriptions remain historically accurate even if the medicine master is later renamed.

---

# 24. Optical Power Module

For ophthalmology/optometry workflows, show an Optical Power section when the logged-in clinical user is authorized and the clinic configuration requires it.

Example:

```text
Doctor Specialty = Ophthalmology
            |
            v
Show Optical Power
```

Initial fields can include:

Right Eye:

```text
SPH
CYL
AXIS
ADD
```

Left Eye:

```text
SPH
CYL
AXIS
ADD
```

Additional fields may include later:

```text
PD
BC
VA
IOP
```

Do not add every possible ophthalmology field until the clinic specifically requires it.

---

# 25. Optical Power Model

Suggested table:

```text
optical_power
- id
- clinic_id
- consultation_id
- patient_id
- recorded_by
- right_sph
- right_cyl
- right_axis
- right_add
- left_sph
- left_cyl
- left_axis
- left_add
- pd
- notes
- created_at
- updated_at
```

Optical power history should be shown as clinic-specific patient history.

---

# 26. Conditional Consultation Sections

Do not build separate consultation pages for different specialties.

Use configurable sections.

```text
ConsultationPage
    |
    +-- PatientHistory
    +-- ConsultationDetails
    +-- OpticalPowerSection       <- conditional
    +-- MedicineSection
    +-- DoctorNotes
    +-- ConsultationActions
```

Example:

```text
Ophthalmologist
    -> Standard Consultation + Optical Power

Optometrist
    -> Optical Power + permitted consultation fields

General Doctor
    -> Standard Consultation
```

The exact permissions must be configuration-driven where practical.

---

# 27. Consultation Letter / Prescription Print

Doctor should be able to generate a print-friendly consultation letter.

Route:

`/consultations/[id]/print`

The page must authenticate and authorize the user before displaying medical data.

The printed document should contain:

## Clinic

- Clinic logo
- Clinic name
- Address
- Phone/email

## Patient

- Name
- Patient number
- Age
- Gender

## Consultation

- Date
- Doctor
- Specialty
- Diagnosis
- Doctor note

## Optical Power

Show only when applicable.

## Prescription

- Medicine
- Dosage
- Frequency
- Duration
- Instructions

## Follow-up

- Follow-up date

## Doctor

- Doctor name
- Qualification
- Signature area

---

# 28. Printing Strategy

Keep printing simple and Vercel-friendly.

Do not introduce a PDF microservice initially.

Use a print-optimized Next.js page and CSS:

```css
@media print {
  /* hide application navigation and controls */
}
```

Then use browser printing:

```text
window.print()
```

A PDF download/export feature can be added later if required.

---

# 29. Medical Documents

Use Supabase Storage.

Examples:

- Lab reports
- Eye reports
- Scanned prescriptions
- Other medical documents

Suggested table:

```text
medical_documents
- id
- clinic_id
- patient_id
- consultation_id
- uploaded_by
- file_name
- storage_path
- document_type
- created_at
```

Storage bucket should be private.

Never expose documents through public URLs.

Access must be authorized.

---

# 30. WhatsApp Notifications

Use WhatsApp Business API/provider from server-side Next.js code.

Events:

```text
APPOINTMENT_CREATED
APPOINTMENT_RESCHEDULED
APPOINTMENT_CANCELLED
APPOINTMENT_CONFIRMED
APPOINTMENT_REMINDER
```

Example:

```text
Hello {{patient_name}},

Your appointment with Dr. {{doctor_name}}
has been scheduled for:

Date: {{date}}
Time: {{time}}

Clinic: {{clinic_name}}
```

Use approved WhatsApp templates where required by the selected WhatsApp platform/provider.

Never expose the WhatsApp access token to the client.

---

# 31. Email Notifications

Use Resend.

Events:

- Appointment confirmation
- Appointment reschedule
- Appointment cancellation
- Appointment reminder

Keep notification handling centralized.

```text
Appointment Service
        |
        v
Notification Service
        |
        +---- Resend
        |
        +---- WhatsApp
```

Do not place email or WhatsApp API calls inside React components.

---

# 32. Notification Log

Create:

```text
notifications
- id
- clinic_id
- patient_id
- appointment_id
- channel
- event_type
- status
- recipient
- provider_message_id
- error_message
- sent_at
- created_at
```

Channels:

```text
EMAIL
WHATSAPP
```

Statuses:

```text
PENDING
SENT
FAILED
```

---

# 33. Audit Logging

Use an audit log for important actions.

Suggested fields:

```text
audit_logs
- id
- clinic_id
- user_id
- action
- entity_type
- entity_id
- created_at
```

Examples:

```text
PATIENT_CREATED
PATIENT_UPDATED
APPOINTMENT_CREATED
APPOINTMENT_RESCHEDULED
APPOINTMENT_CANCELLED
CONSULTATION_CREATED
CONSULTATION_UPDATED
PRESCRIPTION_CREATED
OPTICAL_POWER_UPDATED
MEDICINE_CREATED
MEDICINE_DEACTIVATED
DOCUMENT_UPLOADED
USER_CREATED
```

Do not unnecessarily store the full medical content inside the audit log.

---

# 34. Database Relationship Overview

```text
                         clinics
                            |
          +-----------------+------------------+
          |                 |                  |
          v                 v                  v
      profiles          patients          medicines
          |                 |
          |                 +--------+
          |                          |
          |                          v
          |                     appointments
          |                          |
          |                          v
          |                     consultations
          |                          |
          |             +------------+------------+
          |             |            |            |
          |             v            v            v
          |       prescriptions  optical_power  documents
          |             |
          |             v
          |     prescription_items
          |
          +---- billing_services
          |         |
          |         v
          |      invoices
          |         |
          |         +---- invoice_items
          |         |
          |         +---- payments
          |
          +---- doctor / staff / admin roles
```

All clinic-owned branches must maintain clinic ownership.

Billing relationships must also enforce clinic ownership:

```text
billing_services.clinic_id = invoices.clinic_id = payments.clinic_id
```

A user must never be able to use an invoice ID, payment ID, or service ID from another clinic to bypass tenant isolation.

---

# 35. Tenant-Aware Queries

Every server-side operation must establish:

```text
currentUser
currentRole
currentClinic
```

Then perform authorization before accessing data.

Example flow:

```text
Request
  |
  v
Authenticate
  |
  v
Get profile
  |
  v
Resolve role + clinic
  |
  v
Authorize action
  |
  v
Query Supabase
  |
  v
Return minimum required data
```

Do not allow a caller to override tenant context.

---

# 36. Supabase RLS

RLS is mandatory for clinic-owned data.

Conceptually:

```text
Authenticated User
       |
       v
profiles
       |
       +---- role
       +---- clinic_id
       |
       v
RLS policies
       |
       v
Only authorized clinic data
```

Clinic user policy concept:

```text
record.clinic_id = current user's clinic_id
```

Patient policy concept:

```text
record.patient_id belongs to current patient
```

SUPER_ADMIN requires a separate carefully scoped policy.

Do not disable RLS to simplify application development.

---

# 37. Service-Role Key

`SUPABASE_SERVICE_ROLE_KEY` must remain server-only.

Use it only where necessary.

Prefer authenticated Supabase access + RLS for normal application operations.

Never expose the service-role key in:

- React components
- Client-side JavaScript
- `NEXT_PUBLIC_*` variables
- Browser network responses

---

# 38. Suggested Project Structure

```text
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── clinics/
│   │   ├── patients/
│   │   ├── appointments/
│   │   ├── consultations/
│   │   ├── medicines/
│   │   ├── billing/
│   │   ├── doctors/
│   │   └── users/
│   │
│   ├── consultations/
│   │   └── [id]/
│   │       └── print/
│   │
│   ├── billing/
│   │   ├── invoices/
│   │   │   ├── [id]/
│   │   │   │   └── print/
│   │   │   └── page.tsx
│   │   ├── payments/
│   │   │   └── [id]/
│   │   │       └── receipt/
│   │   └── services/
│   │
│   ├── api/
│   │   ├── appointments/
│   │   ├── patients/
│   │   ├── consultations/
│   │   ├── medicines/
│   │   ├── billing/
│   │   └── notifications/
│   │
│   └── layout.tsx
│
├── components/
│   ├── common/
│   ├── layout/
│   ├── forms/
│   ├── tables/
│   └── consultation/
│
├── features/
│   ├── clinics/
│   ├── users/
│   ├── patients/
│   ├── appointments/
│   ├── consultations/
│   ├── medicines/
│   ├── prescriptions/
│   ├── optical-power/
│   ├── billing/
│   ├── doctors/
│   └── notifications/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── notifications/
│   │   ├── email/
│   │   └── whatsapp/
│   ├── validation/
│   └── utils/
│
├── config/
│   ├── app.ts
│   ├── auth.ts
│   ├── email.ts
│   ├── whatsapp.ts
│   ├── navigation.ts
│   └── consultation.ts
│
├── types/
│   ├── clinic.ts
│   ├── user.ts
│   ├── patient.ts
│   ├── appointment.ts
│   ├── consultation.ts
│   ├── medicine.ts
│   ├── optical-power.ts
│   ├── billing.ts
│   └── payment.ts
│
└── middleware.ts

supabase/
└── migrations/

.env.example
```

Do not create unnecessary abstractions beyond this structure.

---

# 39. Role-Based Navigation

The login page is shared.

After login, navigation should be generated according to role.

Example:

SUPER_ADMIN:

```text
Dashboard
Patients
Appointments
Consultations
Billing
Medicines
Users
Clinic Settings
Platform Users
Settings
```

ADMIN:

```text
Dashboard
Patients
Appointments
Doctors
Users
Medicines
Clinic Settings
```

DOCTOR:

```text
Dashboard
Appointments
Patients
Consultations
Prescriptions
```

OPTOMETRIST:

```text
Dashboard
Appointments
Patients
Optical Power
Consultations
```

FRONT_DESK:

```text
Dashboard
Patients
Appointments
```

PATIENT:

```text
Dashboard
Appointments
Consultations
Prescriptions
Documents
```

This is a UI concern only. Server-side authorization remains mandatory.

---

# 40. Clinic Context in UI

Clinic users should see the clinic name in the application header.

Example:

```text
-------------------------------------------------
Clinic Name                     Tushar Patil ▼
-------------------------------------------------
```

For the initial version, clinic users must not have a clinic switcher.

The application should automatically use the authenticated user's clinic.

A clinic switcher should only be introduced later if a business role explicitly needs multi-clinic access.

---

# 41. Super Admin Clinic Management

SUPER_ADMIN dashboard should provide:

- Clinic list
- Create clinic
- View clinic
- Activate clinic
- Deactivate clinic
- View clinic ADMIN
- Manage clinic status

Suggested clinic list:

```text
Clinic Name
Clinic Code
Admin
Status
Created Date
Actions
```

SUPER_ADMIN should not need to enter `clinic_id` manually when creating clinic-owned records.

---

# 42. Clinic Creation Workflow

```text
SUPER_ADMIN
     |
     v
Create Clinic
     |
     +---- Clinic validation
     |
     v
Create clinic row
     |
     v
Create ADMIN auth user
     |
     v
Create ADMIN profile
     |
     v
Assign clinic_id
     |
     v
Send onboarding email
```

The implementation must handle failure safely.

Do not leave a clinic without its expected ADMIN because a later step failed silently.

Where database/auth operations cannot be made fully transactional together, design an explicit provisioning status/retry process rather than assuming all operations are atomic.

---

# 43. Admin User Creation Workflow

```text
Clinic ADMIN
     |
     v
Create User
     |
     v
Choose Role
     |
     +---- DOCTOR
     +---- OPTOMETRIST
     +---- STAFF
     +---- FRONT_DESK
     |
     v
Server assigns clinic_id
     |
     v
Create user
     |
     v
Send onboarding credentials/invite
```

ADMIN must never be allowed to select another clinic during this process.

---

# 44. Authentication and Onboarding

Prefer secure invitation/onboarding flows rather than sending permanent passwords through email.

The system may:

1. Create the user.
2. Send an invitation/password setup email.
3. User activates account.
4. User logs in through the shared login page.

The exact mechanism should use Supabase Auth capabilities and remain Vercel-compatible.

---

# 45. Vercel Deployment Requirement

The application MUST remain deployable directly to Vercel.

Do not introduce:

- Express server
- Custom Node server
- Long-running worker process
- Local file persistence
- In-memory persistent application state
- Docker-only deployment
- Separate backend deployment

All persistent data belongs in Supabase.

All files belong in Supabase Storage.

All secrets belong in Vercel environment variables.

---

# 46. Environment Variables

Use:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

RESEND_API_KEY=
EMAIL_FROM=

WHATSAPP_API_URL=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
```

Maintain:

`.env.example`

Do not commit secrets.

---

# 47. Testing Strategy

Prioritize the highest-risk business behavior.

## Authentication

- Shared login works for all roles
- Inactive users cannot access application
- Clinic user cannot switch clinic

## Multi-Tenancy

- Clinic A cannot access Clinic B data
- ADMIN A cannot create users in Clinic B
- Doctor A cannot access unauthorized Clinic B patients
- Front Desk A cannot modify Clinic B appointments
- Patient A cannot access Patient B records
- SUPER_ADMIN platform operations work as designed

## Appointment

- Create
- Reschedule
- Cancel
- Conflict detection
- Correct clinic ownership

## Consultation

- Create
- Update
- Add doctor note
- Add medicines
- Add optical power
- Generate print view

## Medicine

- Create
- Update
- Deactivate
- Select active medicine
- Prevent inactive medicine from new prescriptions

## Notifications

- Appointment created
- Appointment changed
- Appointment cancelled
- Correct clinic/patient recipient

## Billing

- Create billing service
- Update/deactivate billing service
- Create invoice
- Correct invoice totals
- Record cash/card/UPI payment
- Prevent payment above outstanding balance
- Update invoice status correctly
- Cancel/void invoice rules
- Print invoice
- Print receipt
- Clinic A cannot access Clinic B invoices or payments

---

# 48. Security Testing Priority

Multi-tenant security must be tested explicitly.

Test attempts such as:

```text
User from Clinic A
     |
     +---- request Clinic B patient
     +---- request Clinic B appointment
     +---- request Clinic B consultation
     +---- request Clinic B document
     +---- create Clinic B medicine
     +---- request Clinic B invoice
     +---- request Clinic B payment
     +---- create Clinic B invoice
     +---- record payment against Clinic B invoice
```

Every unauthorized request must fail.

Do not assume RLS is correct merely because policies exist. Test them.

---

# 49. Coding Rules for AI

Always follow these rules:

1. Keep the implementation simple.
2. Prefer readable TypeScript.
3. Avoid over-engineering.
4. Do not introduce unnecessary design patterns.
5. Do not introduce unnecessary third-party libraries.
6. Prefer Next.js built-in features.
7. Keep business logic outside React presentation components.
8. Reuse existing components and utilities.
9. Do not rewrite working code unnecessarily.
10. Never bypass authorization for convenience.
11. Never disable RLS to solve a development problem.
12. Never trust client-provided `clinic_id`.
13. Derive tenant context from the authenticated user's trusted profile.
14. Always validate clinic ownership server-side.
15. Never expose secrets.
16. Never expose the Supabase service-role key to the browser.
17. Keep sensitive medical data out of unnecessary logs.
18. Keep database changes in explicit Supabase migrations.
19. Do not silently change the database schema.
20. Preserve historical prescriptions and medical records.
21. Use deactivation rather than hard deletion for master data referenced by history.
22. Keep Vercel compatibility at all times.

---

# 50. Development Phases

## Phase 1 — Foundation

- Create Next.js project
- Configure TypeScript
- Configure MUI
- Configure Supabase
- Configure Vercel
- Create environment configuration
- Create shared login page
- Implement authentication

## Phase 2 — Multi-Tenancy

- Create clinics table
- Create profiles
- Implement roles
- Implement clinic context
- Implement RLS
- Implement SUPER_ADMIN
- Implement clinic creation
- Automatically provision clinic ADMIN

## Phase 3 — Clinic User Management

- ADMIN dashboard
- Create Doctor
- Create Optometrist
- Create Staff
- Create Front Desk
- User activation/deactivation

## Phase 4 — Patient Management

- Patient CRUD
- Patient search
- Patient history

## Phase 5 — Doctor and Availability

- Doctor profile
- Specialty
- Availability

## Phase 6 — Appointments

- Schedule
- Reschedule
- Cancel
- Check-in
- Status management
- Conflict detection

## Phase 7 — Consultation

- Consultation page
- Patient history
- Doctor notes
- Diagnosis
- Follow-up

## Phase 8 — Medicine Master

- Admin medicine CRUD
- Medicine search/select
- Deactivate medicine

## Phase 9 — Prescriptions

- Consulted medicines
- Dosage
- Frequency
- Duration
- Instructions

## Phase 10 — Optical Power

- Ophthalmologist configuration
- Optometrist configuration
- Optical power capture
- Optical power history

## Phase 11 — Consultation Letter

- Print-friendly consultation page
- Prescription print
- Optical power print
- Doctor information
- Clinic branding

## Phase 12 — Billing

- Billing service master
- Invoice creation
- Invoice items
- Payment recording
- Invoice status
- Outstanding balance
- Invoice print
- Receipt print
- Billing history
- Billing RLS and authorization

## Phase 13 — Notifications

- Resend email
- WhatsApp integration
- Notification log
- Appointment reminder

## Phase 14 — Documents and Audit

- Private medical documents
- Audit logs

## Phase 15 — Security and Production Readiness

- Multi-tenant RLS review
- Authorization testing
- Security testing
- Error handling
- Performance checks
- Vercel production deployment

---

# 51. Primary End-to-End Workflow

The application should ultimately support this complete workflow:

```text
SUPER_ADMIN
    |
    v
Create Clinic
    |
    v
Clinic ADMIN automatically created
    |
    v
ADMIN logs in through same /login
    |
    +---- Create Doctor
    +---- Create Optometrist
    +---- Create Staff
    +---- Create Front Desk
    +---- Manage Medicines
    |
    v
Front Desk logs in through same /login
    |
    v
Register Patient
    |
    v
Schedule Appointment
    |
    +----------+----------+
    |                     |
    v                     v
 WhatsApp                Email
    |
    v
Patient Arrives
    |
    v
Doctor logs in through same /login
    |
    v
Open Consultation
    |
    +----------------------+--------------------+
    |                      |                    |
    v                      v                    v
Patient History       Doctor Note        Optical Power
                                             |
                                             | when applicable
                                             v
                                   Ophthalmologist/Optometrist
    |
    v
Select Consulted Medicines
    |
    v
Create Prescription
    |
    v
Save Consultation
    |
    +---------------------+
    |                     |
    v                     v
Generate Consultation   Create / Review
Letter                  Invoice
    |                     |
    v                     v
Print Letter           Record Payment
                          |
                          v
                      Print Receipt
    |
    v
Patient can later view authorized records and billing status
```

---

# 52. Definition of Done

A feature is complete only when:

- UI is implemented
- Responsive behavior works
- Loading state exists
- Empty state exists
- Error state exists
- Server-side validation exists
- Role authorization exists
- Tenant authorization exists
- Supabase RLS is implemented/tested
- Important business logic has tests
- No secrets are exposed
- No unnecessary dependency is introduced
- Database changes are explicit migrations
- Historical records remain intact
- Billing totals and payment rules are enforced server-side
- Invoice and receipt printing works
- Billing tenant isolation is verified
- Vercel deployment continues to work

---

# 53. Product Principle

The architecture should remain:

```text
One Next.js Application
        +
Multiple Clinics / Tenants
        +
One Shared Login Page
        +
Role-Based Access
        +
Clinic-Level Data Isolation
        +
Supabase RLS
        +
Simple Clinical Workflow
        +
Vercel Deployment
```

The most important security rule is:

> Never trust clinic context or authorization information supplied by the browser. Resolve the authenticated user's role and clinic server-side and enforce tenant isolation through Supabase RLS.

The most important engineering rule is:

> Keep the solution simple. Do not introduce architecture that is not required by the product.
