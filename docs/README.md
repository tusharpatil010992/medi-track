# Medi-Track Documentation

Complete documentation for the Medi-Track medical records and clinic management system.

---

## Quick Navigation

### 📋 Start Here
0. **[setup.md](./setup.md)** - Get it running, seed the first SUPER_ADMIN, and run the tenant-isolation tests
1. **[architecture.md](./architecture.md)** - System design and multi-tenant architecture
   - Project overview
   - Technology stack
   - User roles and permissions
   - Data ownership and isolation
   - Security principles

2. **[requirements.md](./requirements.md)** - Functional requirements and features
   - Phase 1-5 requirements
   - Feature descriptions
   - Complete workflows
   - Definition of Done
   - Testing strategy

3. **[database.md](./database.md)** - Database design and schema
   - Database configuration
   - Complete schema with all tables
   - RLS policies
   - Multi-tenant query patterns
   - Soft delete strategy

4. **[development-rules.md](./development-rules.md)** - Frontend and coding rules
   - Frontend stack (MUI)
   - Theme system and colors
   - Typography and spacing
   - Component patterns
   - Accessibility guidelines
   - Responsive design rules

---

## For Different Roles

### For Architects & Product Managers
→ Read: [architecture.md](./architecture.md) + [requirements.md](./requirements.md)

Understand the system design, multi-tenancy model, security principles, and complete feature set across all 5 phases.

### For Backend/Database Engineers
→ Read: [database.md](./database.md) + [architecture.md](./architecture.md)

Learn about the database schema, RLS policies, multi-tenant query patterns, and how to maintain data isolation.

### For Frontend Engineers
→ Read: [development-rules.md](./development-rules.md) + [architecture.md](./architecture.md)

Master the MUI theme system, component patterns, responsive design, accessibility requirements, and coding standards.

### For QA/Testing
→ Read: [requirements.md](./requirements.md) + [architecture.md](./architecture.md)

Understand the features to test, testing strategy, Definition of Done criteria, and security testing priorities.

### For DevOps/Infrastructure
→ Read: [architecture.md](./architecture.md) (Vercel Deployment section)

Understand deployment requirements and Vercel compatibility.

---

## Documentation Structure

```
docs/
├── README.md                    # This file
├── setup.md                     # Setup, seeding, and isolation verification
├── architecture.md              # System design
├── requirements.md              # Features and requirements (5 phases)
├── database.md                  # Database schema and RLS
└── development-rules.md         # Frontend and coding rules

supabase/migrations/             # One migration per phase, applied in order
├── 0001_phase1_foundation.sql
├── 0002_phase2_patients_appointments.sql
├── 0003_phase3_clinical.sql
├── 0004_letterhead_gap.sql
├── 0005_clinic_deactivation.sql
└── 0006_phase4_billing_notifications.sql
```

---

## Key Concepts

### Multi-Tenancy
Every clinic is a completely isolated tenant. Users from Clinic A **cannot** access any data from Clinic B. This is enforced at:
- Application level (server-side authorization)
- Database level (Supabase RLS policies)

**Golden Rule:** Never trust `clinic_id` from the browser. Always derive it server-side from the authenticated user's profile.

### Role-Based Access
7 user roles with different permissions:
- `SUPER_ADMIN` - Platform level
- `ADMIN` - Clinic level
- `DOCTOR` - Clinical staff
- `OPTOMETRIST` - Clinical staff
- `STAFF` - Operational staff
- `FRONT_DESK` - Front desk staff
- `PATIENT` - Patient access only

Each role has explicit permissions documented in [architecture.md](./architecture.md).

### Soft Deletes
Never hard-delete records that are referenced by history. Use `is_active = false` instead.
This preserves:
- Historical data
- Audit trails
- Historical prescriptions
- Past invoices

### No Database Triggers
Application code handles:
- Setting `updated_at` timestamps
- Logging audit events
- Any data transformations

This keeps the schema simple and logic explicit.

### Vercel Deployment
Application must remain deployable to Vercel. This means:
- No persistent worker processes
- No local file storage
- No Docker requirement
- All data in Supabase
- All files in Supabase Storage

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- Authentication and multi-tenancy setup
- Clinic management and ADMIN provisioning
- Role-based navigation
- User management
- See: [requirements.md - Phase 1](./requirements.md#phase-1-foundation-multi-tenancy--clinic-users)

### Phase 2: Patients & Appointments (Weeks 3-4)
- Patient registration and management
- Doctor availability scheduling
- Appointment booking and management
- See: [requirements.md - Phase 2](./requirements.md#phase-2-patients-doctors--appointments)

### Phase 3: Clinical Workflow (Weeks 5-7)
- Consultation module
- Medicine master
- Prescriptions
- Optical power
- Printing (no PDF service)
- See: [requirements.md - Phase 3](./requirements.md#phase-3-clinical-workflow-medicines--printing)

### Phase 4: Billing & Notifications (Weeks 8-10)
- Invoice generation
- Payment recording
- Email notifications (Resend)
- WhatsApp notifications
- See: [requirements.md - Phase 4](./requirements.md#phase-4-billing--notifications)

### Phase 4.1: Reference numbering
- Patient, consultation and invoice references carry a `YYMMDD` stamp and a
  daily sequence (`P260818001`)
- See: [database.md - Reference numbering](./database.md#reference-numbering)

### Phase 4.2: Invoice line display
- Invoice lines show description and amount only, on screen and in print
- Quantity and unit price are still captured and stored, just not displayed
- See: [database.md - invoice_items](./database.md#phase-4-billing--notifications)

### Phase 4.3: Clinic-defined consultation notes
- The five fixed clinical textareas are replaced by any number of notes, each
  with a field, free text, and a "show on printed letter" checkbox
- The field list is clinic master data at `/note-types`, maintained by ADMIN
  **and DOCTOR**
- See: [requirements.md - Phase 4.3](./requirements.md#phase-43-clinic-defined-consultation-notes)

### Phase 4.4: Navigation grouping and discount entry
- Medicines, Consultation Fields and Billing Services collapse under one
  **Master Data** heading in the sidebar
- The invoice discount is entered as a percentage — `100` waives the bill — and
  resolved to rupees on the server
- See: [requirements.md - Phase 4.4](./requirements.md#phase-44-navigation-grouping-and-discount-entry)

### Phase 5: Security & Production (Weeks 11-12)
- Medical documents (Supabase Storage)
- Audit logging
- Security testing (cross-clinic attacks)
- Production deployment
- See: [requirements.md - Phase 5](./requirements.md#phase-5-documents-audit--production-readiness)

---

## Security Principles

**Non-Negotiable:**
1. Never trust client-supplied `clinic_id`
2. Always derive clinic context from authenticated user's server-side profile
3. Enforce authorization server-side (not just UI routing)
4. Use Supabase RLS as second line of defense
5. All clinic-owned queries must include clinic_id filter
6. Test cross-clinic access attempts (should all fail)

**See:** [architecture.md - Security Principles](./architecture.md#security-principles)

---

## Testing Priorities

### Multi-Tenancy Testing (Most Critical)
- Clinic A cannot access Clinic B patients
- ADMIN A cannot create users in Clinic B
- Doctor A cannot see Clinic B appointments
- RLS blocks all cross-clinic queries

### Authorization Testing
- Shared login page works for all roles
- Each role sees appropriate UI/features
- Server-side authorization enforced
- Inactive users cannot access app

### Feature Testing
- Full workflows per phase
- Server-side validation
- Database constraints
- Error handling

**See:** [requirements.md - Testing Strategy](./requirements.md#testing-strategy)

---

## Definition of Done

A feature is complete when:
- ✅ UI implemented and responsive
- ✅ Server-side logic implemented
- ✅ Authorization checked server-side
- ✅ Clinic_id enforced server-side
- ✅ RLS policies tested
- ✅ Cross-clinic access blocked
- ✅ Loading/empty/error states shown
- ✅ Dark mode works
- ✅ Accessible (WCAG 2.1 AA)
- ✅ TypeScript strict mode
- ✅ No hardcoded colors/values
- ✅ No secrets exposed
- ✅ Historical data preserved
- ✅ Vercel deployment works

**See:** [requirements.md - Definition of Done](./requirements.md#definition-of-done)

---

## Technology Stack Reference

**Frontend:**
- Next.js 15+ (React 19+)
- TypeScript (strict mode)
- Material UI (MUI) v5+
- No Tailwind, no custom CSS libraries

**Backend:**
- Next.js Route Handlers and Server Actions
- No Express, no NestJS

**Database:**
- Supabase (PostgreSQL)
- Row Level Security (RLS)
- Authentication via Supabase Auth

**Email:**
- Resend

**WhatsApp:**
- WhatsApp Business API/Provider

**Hosting:**
- Vercel

**See:** [architecture.md - Technology Stack](./architecture.md#technology-stack-non-negotiable)

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/login/
│   ├── (dashboard)/        # Role-based pages
│   ├── api/                # Route handlers
│   └── layout.tsx
├── components/             # React components (MUI-based)
├── features/               # Business logic by feature
├── lib/                    # Utilities and helpers
├── types/                  # TypeScript types
├── config/                 # Configuration files
├── themes/                 # MUI theme definitions
└── middleware.ts           # Next.js middleware

plan/
├── PHASE1_READINESS.md     # Phase 1 checklist
└── schema.sql              # Complete database schema

docs/
├── README.md               # This file
├── architecture.md         # System design
├── requirements.md         # Features and requirements
├── database.md             # Database design
└── development-rules.md    # Frontend and coding rules
```

---

## Common Questions

**Q: Can I trust clinic_id from the browser?**  
A: No. Always derive it from the authenticated user's server-side profile.

**Q: Should I hard-delete old records?**  
A: No. Use `is_active = false` (soft delete) to preserve history.

**Q: Can I use Tailwind CSS?**  
A: No. Use MUI's `sx` prop for styling.

**Q: Do I need to implement an Express backend?**  
A: No. Use Next.js Route Handlers and Server Actions.

**Q: Should I add database triggers for updated_at?**  
A: No. Application code handles `updated_at` explicitly.

**Q: Can clinic users access multiple clinics?**  
A: Not in the initial design. SUPER_ADMIN only.

**Q: What about PDF generation?**  
A: Use `window.print()` + `@media print` CSS. No PDF service.

**Q: How do I ensure RLS is working?**  
A: Test cross-clinic access in Supabase SQL Editor as different users.

---

## External References

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Material UI Documentation](https://mui.com/material-ui/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev)

---

## Last Updated

2026-08-19 — Phases 1–4 delivered, plus Phase 4.1 (date-stamped reference
numbers), Phase 4.2 (invoice lines show amount only), Phase 4.3 (clinic-defined
consultation notes) and Phase 4.4 (Master Data nav group, percentage discount);
Phase 5 not started.

---

## Legend

📋 = Documentation  
✅ = Complete  
⚠️ = Important  
🚀 = Ready for development  
❌ = Do not do
