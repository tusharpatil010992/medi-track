# Phase 2 — Implementation Summary

**Scope:** Patients, Doctors & Appointments
**Status:** Complete. Schema applied; 24/24 isolation and behaviour tests passing against the live database.
**Date:** 2026-08-16

---

## 1. What was delivered

| Phase 2 requirement (`docs/requirements.md`) | Delivered |
|---|---|
| Patient CRUD | `/patients/new`, `/patients/[id]`, `/patients/[id]/edit`; deactivate, never delete |
| Patient search | Debounced search over name, patient number and phone |
| Patient history (audit trail) | Every create/update/deactivate writes a `patient_history` row |
| Clinic-scoped patients | `UNIQUE(clinic_id, patient_number)`, auto-allocated `P-0001` |
| Doctor profile, specialty | Carried from Phase 1 `profiles` |
| Availability scheduling | `/schedule` — weekly windows, doctor edits own only |
| Schedule / reschedule / cancel | Server actions with full validation |
| Check-in | `CHECKED_IN` status, reachable from the day view |
| Status lifecycle | 8 states; terminal states refuse further transitions |
| Conflict detection | Overlap check against the doctor's day, server-side |
| Ownership validation | Patient and doctor must both belong to the caller's clinic |

Not built, by design: consultations, medicines, prescriptions, optical power,
billing, notifications. Those are Phases 3–5.

---

## 2. Defects found in the documented schema

Both were raised before implementation and resolved with the user. `docs/database.md`
is updated to match.

### 2.1 `patients` had no name column — blocking

`docs/database.md` listed `patient_number`, contact details and address, but no
`first_name`, `last_name` or `full_name`. Patient registration and the required
"patient search" are both impossible without one.

**Fix:** added `first_name` and `last_name` as `NOT NULL`, per `plan/Mark1.md` §13.
Separate columns rather than a single field, so surname sort and search work.

### 2.2 `appointment_status` had no `CHECKED_IN` — blocking

Phase 2 requires check-in, but the documented enum offered no state to represent
an arrived patient. `plan/Mark1.md` §15 lists both `CHECKED_IN` and `CONFIRMED`.

**Fix:** both added, restoring the full lifecycle:

```
SCHEDULED → CONFIRMED → CHECKED_IN → IN_PROGRESS → COMPLETED
            ↘ CANCELLED / NO_SHOW / RESCHEDULED
```

`CONFIRMED` also gives Phase 4's appointment reminders somewhere to record a reply.

---

## 3. Decisions

| Decision | Reason |
|---|---|
| `patient_number` auto-allocated (`P-0001`), per clinic | Front desk never invents IDs, so no collisions or typos. Series are independent per clinic — two clinics can both hold a `P-0001`. |
| Writes limited to **FRONT_DESK + DOCTOR** | User's explicit call. ADMIN and OPTOMETRIST read only. |
| Availability owned by DOCTOR only | User's explicit call; enforced by `doctor_id = auth.uid()` in RLS, not just in the UI. |
| Reschedule supersedes rather than edits | The original is marked `RESCHEDULED` and a replacement row is created, so what was booked when survives. |
| `patient_history` is a change-audit table | `docs/database.md` and `requirements.md` agree on this shape. `plan/Mark1.md` §14 describes a clinical-history table instead; clinical history belongs on consultations in Phase 3. |

**Open consequence:** with availability restricted to DOCTOR, an OPTOMETRIST
cannot be booked at all. Phase 3 introduces optometrist consultations, so this
will likely need widening then. Flagged rather than pre-solved.

---

## 4. Files

### Migration
```
supabase/migrations/0002_phase2_patients_appointments.sql
```
`appointment_status` enum · `patients` · `patient_history` ·
`doctor_availability` · `appointments` · indexes · RLS policies.

### Server Actions
```
src/features/patients/actions.ts        createPatient, updatePatient, setPatientActive
src/features/appointments/actions.ts    createAppointment, rescheduleAppointment, setAppointmentStatus
src/features/availability/actions.ts    addAvailability, removeAvailability
```

### Types
```
src/types/patient.ts       Patient, PatientHistoryEntry, patientAge()
src/types/appointment.ts   Appointment, DoctorAvailability, overlap helpers
src/types/user.ts          CLINIC_MEMBER_ROLES, CLINICAL_WRITE_ROLES (added)
```

### UI
```
src/app/(dashboard)/patients/          list + search, new, detail, edit
src/app/(dashboard)/appointments/      day view, booking
src/app/(dashboard)/schedule/          doctor availability editor
src/components/patients/               PatientForm, PatientSearch, PatientStatusToggle
src/components/appointments/           NewAppointmentForm, DayPicker, AppointmentActions, ScheduleEditor, AppointmentStatusChip
```

### Verification
```
scripts/verify-isolation.mjs           re-runnable suite, npm run verify:isolation
```

---

## 5. Appointment validation

Three server-side checks run before any booking is written, in order:

1. **Ownership** — patient and doctor are re-read filtered by the caller's
   `clinic_id`, so an id borrowed from another clinic resolves to nothing.
2. **Availability** — the slot must sit inside a published window for that weekday.
3. **Conflict** — no overlap with the doctor's existing bookings that day.
   Only `SCHEDULED`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS` and `COMPLETED`
   block; a cancelled or no-show slot is free to rebook.

Overlap uses a half-open comparison, so back-to-back appointments (one ending
exactly as the next begins) do not collide.

### Known limitation

The conflict check is read-then-write, so two simultaneous bookings for the same
slot could both pass. Closing it properly needs a `btree_gist` exclusion
constraint on a time range. Deferred as over-engineering at current volume, and
recorded here rather than left silent.

---

## 6. Verification

### Static
```
npm run type-check   ✓
npm run lint         ✓
npm run build        ✓  16 routes + middleware
```

### Isolation and behaviour — 24/24

`npm run verify:isolation`, using real authenticated sessions across two clinics
with ADMIN, FRONT_DESK, two DOCTORs and an OPTOMETRIST. Fixtures are removed
afterwards.

| Group | Tests | Result |
|---|---|---|
| Phase 1 regression (clinic, config, profiles) | 3 | ✅ |
| Cross-clinic reads (patients, availability, appointments) | 4 | ✅ |
| Cross-clinic writes rejected by `WITH CHECK` | 4 | ✅ all `42501` |
| Role write restrictions (ADMIN/OPTOMETRIST blocked, FRONT_DESK allowed) | 4 | ✅ |
| Availability ownership | 3 | ✅ |
| Appointment integrity + overlap helper | 4 | ✅ |
| `patient_number` per-clinic uniqueness | 2 | ✅ |

Two results worth noting:

- **ADMIN and OPTOMETRIST INSERTs rejected with `42501`** — the role restriction
  is enforced in the database, not merely by hiding a button.
- **Same `patient_number` coexists in two clinics, duplicates within one rejected
  with `23505`** — confirms the uniqueness is scoped per clinic as intended.

### A false alarm worth recording

An early probe appeared to show `consultations`, `medicines` and `invoices`
already present, which would have meant the superseded `plan/schema.sql` had
been applied and its weaker `USING`-only policies were live. Re-probing with
explicit error codes disproved it — `head: true` was masking a `PGRST205`
table-not-found. Those tables do not exist. Recorded because the probe technique,
not the database, was at fault.

### Not verified

The browser click-through: registering a patient, booking through the form,
checking in from the day view, and editing a schedule. Server actions and
policies are covered above, but nobody has driven the screens.

---

## 7. To pick this up

```bash
npm run dev
npm run verify:isolation    # re-run any time
```

Phase 3 (Consultations, Medicines & Printing) is unblocked. It should revisit
whether OPTOMETRIST needs bookable availability, since optometrist consultations
arrive in that phase.

---

## 8. References

- Phase 1 summary — [`summary/phase1_implementation.md`](phase1_implementation.md)
- Setup & verification — [`docs/setup.md`](../docs/setup.md)
- Database & RLS — [`docs/database.md`](../docs/database.md)
- Development contract — [`CLAUDE.md`](../CLAUDE.md)
