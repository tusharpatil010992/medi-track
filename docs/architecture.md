# Architecture & System Design

## Project Overview

Build a secure, simple, multi-tenant medical records and clinic management application using Next.js, TypeScript, and Supabase.

**Core Principle:**
> One Next.js Application + Multiple Clinics/Tenants + One Shared Login Page + Role-Based Access + Clinic-Level Data Isolation + Supabase RLS + Simple Clinical Workflow + Vercel Deployment

---

## Technology Stack (Non-Negotiable)

**Use only:**
- Next.js 15+
- React 19+
- TypeScript
- Material UI (MUI) v5+
- Supabase (PostgreSQL + Auth + RLS + Storage)
- Resend (Email)
- WhatsApp Business API/Provider
- Vercel (Hosting)

**Do NOT introduce:**
- Spring Boot, Express, NestJS
- Separate backend application
- Microservices
- Docker requirement
- Custom Node server
- Dedicated persistent worker server

---

## Multi-Tenancy Architecture

### Core Principle
The clinic is the primary tenant and security boundary.

Every clinic-owned record must contain `clinic_id` either directly or through a parent entity whose ownership is enforced.

**Tenant Isolation Rules:**
1. A user must never access another clinic's data
2. Exception: SUPER_ADMIN (platform-level role)
3. Tenant isolation enforced server-side AND with Supabase RLS
4. Never trust `clinic_id` from browser
5. Derive clinic context from authenticated user's trusted server-side profile

### Tenant-Aware Queries

Every server-side operation must establish:
```
currentUser → currentRole → currentClinic
```

Then perform authorization before accessing data.

**Security Model:**
```
Bad:  SELECT * FROM patients WHERE id = patientId
Good: SELECT * FROM patients 
      WHERE id = patientId 
      AND clinic_id = currentUser.clinicId
      AND clinic_id = auth.uid().clinic_id (via RLS)
```

---

## User Roles & Permissions

### SUPER_ADMIN
Platform-level user. Can:
- Create clinics
- View clinics
- Activate/deactivate clinics
- Manage clinic-level configuration
- View clinic status
- Create/regenerate clinic ADMIN account
- Manage platform-level settings

**Not automatically a member of every clinic.**

### ADMIN
Clinic-level administrator. Belongs to exactly one clinic. Can:
- Manage clinic profile
- Manage clinic users
- Create Doctor, Optometrist, Staff, Front Desk accounts
- Manage clinic-level settings
- Manage clinic medicines
- View clinic operational information

### DOCTOR
Clinic-level clinical user. Can:
- View authorized clinic patients
- View patient history
- Conduct consultations
- Add diagnosis and doctor notes
- Add consulted medicines
- Create prescriptions
- View previous consultations
- Print consultation letters
- Record optical information (when authorized)

### OPTOMETRIST
Clinic-level clinical user. Can:
- View authorized patients
- Record optical power
- Update optical power (when allowed)
- View optical power history
- Participate in consultation workflows

### STAFF
Clinic-level user. Permissions configurable later.
Initially allow only operational features required by clinic.
Do not give clinical write permissions by default.

### FRONT_DESK
Clinic-level operational user. Can:
- Register patients
- Edit patient demographic information
- Search patients
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

May perform billing operations if enabled.

### PATIENT
Patient access restricted to own records. Can:
- View own profile
- View own appointments
- View own consultation history
- View prescriptions
- View consultation letters
- View permitted documents
- Receive notifications (email/WhatsApp)

**Must never access another patient's information.**

---

## Authentication Flow

### Shared Login Page
Single login page for all users: `/login`

Do NOT create separate login pages per role.

After authentication:
```
Login
  ↓
Supabase Auth
  ↓
Load application profile
  ├→ SUPER_ADMIN
  ├→ ADMIN
  ├→ DOCTOR
  ├→ OPTOMETRIST
  ├→ STAFF
  ├→ FRONT_DESK
  └→ PATIENT
  ↓
Resolve clinic context
  ↓
Authorize
  ↓
Redirect to role-appropriate dashboard
```

**Critical:** Authenticated user's clinic must be derived from trusted server-side profile data.
Never trust `clinic_id` supplied by browser.

---

## Role + Tenant Authorization

Authorization based on:
```
user.role + user.clinic_id
```

**Examples:**
- `ADMIN + Clinic A` → Can manage Clinic A only
- `DOCTOR + Clinic A` → Can access only Clinic A records
- `PATIENT + Clinic A` → Can access only own records
- `SUPER_ADMIN` → Can access platform-level clinic administration

---

## Data Ownership

### Clinic-Owned Records
- Patients
- Doctors/Optometrists/Staff
- Appointments
- Consultations
- Medicines
- Prescriptions
- Documents
- Notifications
- Billing services
- Invoices
- Payments
- Audit logs

All must maintain `clinic_id` ownership.

### Clinic-Level Configuration
- `clinic_config`: Resend API key, WhatsApp tokens, timezone, etc.
- Each clinic has independent configuration

---

## Vercel Deployment Requirements

Application MUST remain deployable directly to Vercel.

**Do NOT introduce:**
- Express server
- Custom Node server
- Long-running worker process
- Local file persistence
- In-memory persistent application state
- Docker-only deployment
- Separate backend deployment

**Storage:**
- Persistent data → Supabase PostgreSQL
- Files → Supabase Storage (private bucket)
- Secrets → Vercel environment variables
- State → React/Zustand (temporary, session-based)

---

## Security Principles

### The Golden Rule
> Never trust clinic context or authorization information supplied by the browser. Resolve the authenticated user's role and clinic server-side and enforce tenant isolation through Supabase RLS.

### Key Security Rules
1. Never trust client-supplied `clinic_id`
2. Never bypass authorization for convenience
3. Never disable RLS
4. Always validate clinic ownership server-side
5. Never expose secrets to browser
6. Never expose Supabase service-role key
7. Keep sensitive medical data out of unnecessary logs
8. Keep database changes in explicit migrations
9. Preserve historical records (soft deletes only)
10. Maintain Vercel compatibility at all times

---

## System Components

### Next.js Responsibilities
- UI (Server Components + Client Components)
- Server Actions
- Route Handlers
- Authentication integration
- Authorization checks
- Business logic
- Notification orchestration

### Supabase Responsibilities
- PostgreSQL database
- Authentication (Supabase Auth)
- Row Level Security (RLS)
- File Storage (private bucket)

### Vercel Responsibilities
- Next.js hosting
- CI/CD deployment
- Preview deployments
- Production deployment
- Scheduled jobs (where appropriate)

### Resend Responsibilities
- Email delivery

### WhatsApp Business API
- WhatsApp notifications

---

## Data Isolation at Boundaries

### API Boundaries
Every API route must:
1. Authenticate the user
2. Resolve the user's role and clinic_id
3. Check authorization
4. Enforce clinic_id in all queries
5. Return only authorized data

### Database Boundaries (RLS)
Supabase RLS policies on all clinic-owned tables:
```sql
record.clinic_id = current_user.clinic_id
```

RLS is mandatory. It is the second line of defense after application logic.

### UI Boundaries
- Role-based navigation (UI only; server authorization is the real boundary)
- Hide features based on role
- Never assume UI hiding means authorization

---

## Clinic Provisioning

When SUPER_ADMIN creates a new clinic:

```
SUPER_ADMIN
  ↓
Create Clinic
  ↓
Create clinic_config (auto-generated with dummy values)
  ↓
Create Clinic ADMIN auth user
  ↓
Create Clinic ADMIN profile
  ↓
Assign ADMIN to Clinic
  ↓
Send initial access information
```

Process should be transactional where possible.
Where not fully transactional, design explicit provisioning status/retry logic.

---

## Admin User Management

When clinic ADMIN creates a user:

```
Clinic ADMIN
  ↓
Create User
  ↓
Choose Role (DOCTOR, OPTOMETRIST, STAFF, FRONT_DESK)
  ↓
Server assigns clinic_id (from authenticated admin, never from request)
  ↓
Create user
  ↓
Send onboarding credentials/invite
```

**Critical:** ADMIN must never be allowed to select another clinic.
Server must assign `clinic_id` from authenticated user's profile.

---

## Project Structure

```
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
```

Do not create unnecessary abstractions beyond this structure.

---

## Coding Principles

### Always Follow These Rules
1. Keep implementation simple
2. Prefer readable TypeScript
3. Avoid over-engineering
4. Do not introduce unnecessary design patterns
5. Do not introduce unnecessary third-party libraries
6. Prefer Next.js built-in features
7. Keep business logic outside React presentation components
8. Reuse existing components and utilities
9. Do not rewrite working code unnecessarily
10. Never bypass authorization for convenience
11. Never disable RLS to solve a development problem
12. Never trust client-provided `clinic_id`
13. Derive tenant context from authenticated user's trusted profile
14. Always validate clinic ownership server-side
15. Never expose secrets
16. Never expose Supabase service-role key to browser
17. Keep sensitive medical data out of unnecessary logs
18. Keep database changes in explicit Supabase migrations
19. Do not silently change database schema
20. Preserve historical prescriptions and medical records
21. Use deactivation instead of hard deletion for master data referenced by history
22. Keep Vercel compatibility at all times
