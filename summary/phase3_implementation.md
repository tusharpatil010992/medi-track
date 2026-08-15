# Phase 3 — Implementation Summary

**Scope:** Clinical Workflow — Consultations, Medicines, Prescriptions, Optical Power & Printing
**Status:** Complete. Migration applied; 44/44 isolation and behaviour tests passing against the live database.
**Date:** 2026-08-16

---

## 1. What was delivered

| Phase 3 requirement (`docs/requirements.md`) | Delivered |
|---|---|
| Consultation page `/consultations/[id]` | Clinical workspace with composed sections |
| Conditional sections by role/specialty | Optical power renders only for qualifying clinicians |
| Chief complaint, history, diagnosis, follow-up | All on the consultation form |
| Status `DRAFT → IN_PROGRESS → COMPLETED/CANCELLED` | Enforced; closed consultations become read-only |
| Medicine master, ADMIN-managed | `/medicines` with add and deactivate |
| Deactivate, never hard-delete | `is_active` only; no DELETE policy |
| Doctor searches and selects medicines | Dropdown limited to active medicines |
| One prescription per consultation, many items | `UNIQUE(consultation_id)` on prescriptions |
| `medicine_name_snapshot` | Captured at prescribe time; verified against a rename |
| Inactive medicines rejected for new items | Server-side check in `savePrescription` |
| Optical power SPH/CYL/AXIS/PD + history | Full grid, both eyes, **plus ADD** |
| Print letter `/consultations/[id]/print` | `window.print()` + `@media print`, no PDF service |

Not built, by design: billing, invoices, payments, notifications, documents,
audit logs. Those are Phases 4–5.

---

## 2. Defect found in the documented schema

### `optical_power` had no ADD column

`docs/database.md` listed SPH, CYL, AXIS and PD, but not the near-vision
addition. `plan/Mark1.md` §25 specifies `right_add` / `left_add`.

Without ADD you cannot write a reading or bifocal prescription — which rules out
most patients with presbyopia, a large share of any optical practice.

**Fix:** `right_eye_add` and `left_eye_add` added; `docs/database.md` updated.
The isolation suite asserts an ADD value round-trips.

---

## 3. Decisions

| Decision | Reason |
|---|---|
| OPTOMETRIST records optical power **only** | User: *"their job is just to measure the optical power and save them, even doctor him/herself can add the same."* No consultations, no prescribing, still unbookable. |
| DOCTOR may record optical power too | Same instruction. |
| Optical section shows for ophthalmologists | User: *"show only if DOCTOR is OPTHALMOLOGIST"* — plus OPTOMETRIST always, since measuring is their remit. |
| `appointment_id` NULLABLE | Walk-in consultations allowed. UNIQUE still holds because Postgres treats NULLs as distinct. |
| Consultations are DOCTOR-write | ADMIN, FRONT_DESK and OPTOMETRIST are all refused at the database. |
| Medicines are ADMIN-write, clinical-read | Per `plan/Mark1.md` §20. FRONT_DESK cannot read them at all. |
| Completing a consultation completes its appointment | Stops a finished patient sitting "in progress" on the day view. |

---

## 4. Where a rule deliberately does not live in RLS

The "only an ophthalmologist sees optical power" rule reads
`profiles.specialty`, a **free-text column**. It cannot be matched reliably
inside a policy — a typo or different wording would silently change who is
authorised.

So the rule is split:

| Layer | Enforces |
|---|---|
| RLS | **Role** — only DOCTOR and OPTOMETRIST may write `optical_power` |
| Server action + UI | **Specialty** — `recordsOpticalPower()` in `src/types/user.ts` |

RLS stays the outer boundary and is what the tests verify: FRONT_DESK is
refused with `42501`, and so is every other clinic. The specialty check narrows
within that boundary and is a **workflow convenience, not a security control**.

Consequence ADMINs must know: a doctor whose specialty does not contain
"ophthalm" will not see the section. The match is deliberately loose
(`/ophthalm/i`) to cover "Ophthalmology", "Ophthalmologist" and "Ophthalmic".

Recorded in `docs/database.md` and `summary/open-items.md`.

---

## 5. Files

### Migration
```
supabase/migrations/0003_phase3_clinical.sql
```
2 enums · 5 tables · 15 RLS policies · indexes.

### Server Actions
```
src/features/consultations/actions.ts    createConsultation, updateConsultation, setConsultationStatus
src/features/medicines/actions.ts        createMedicine, updateMedicine, setMedicineActive
src/features/prescriptions/actions.ts    savePrescription
src/features/optical-power/actions.ts    saveOpticalPower
```

### UI
```
src/app/(dashboard)/consultations/       list, new, [id] workspace
src/app/(dashboard)/medicines/           ADMIN master
src/app/consultations/[id]/print/        letter + print.module.css
src/components/consultations/            ConsultationDetailsForm, OpticalPowerForm,
                                         PrescriptionForm, ConsultationStatusActions,
                                         NewConsultationForm, PrintButton
src/components/medicines/                MedicineForm, MedicineStatusToggle
src/types/clinical.ts                    Consultation, Medicine, Prescription, OpticalPower
```

The print page sits **outside** the `(dashboard)` group so no sidebar or app bar
renders, and uses plain CSS modules rather than MUI `sx` — printed output must be
fixed, not theme-driven or responsive. It still authenticates and authorises
before showing any medical data (verified: signed-out requests 307 to `/login`).

### No clinic header on the letter

Clinics print these on their own pre-printed letterhead, so the letter renders
**no clinic name, address or contact block**. Deleting the header alone was not
enough: content would then start at the very top of the page and print over the
letterhead. A 35mm band is reserved instead — outlined and labelled on screen so
the gap is self-explanatory during preview, invisible on paper with only the
height retained.

Consequence to be aware of: a clinic that prints on **plain paper** now gets an
unbranded letter. If that comes up, the fix is a per-clinic toggle in
`clinic_config`; not added now, since nothing asked for it.

---

## 6. Verification

### Static
```
npm run type-check   ✓
npm run lint         ✓
npm run build        ✓  21 routes + middleware
```

### Isolation and behaviour — 44/44

`npm run verify:isolation`, using real authenticated sessions across two clinics
with ADMIN, FRONT_DESK, two DOCTORs and an OPTOMETRIST. Fixtures removed after.

| Group | Tests | Result |
|---|---|---|
| Phase 1 regression | 3 | ✅ |
| Phase 2 regression | 21 | ✅ |
| Consultations are DOCTOR-only | 5 | ✅ |
| Medicines are ADMIN-managed | 4 | ✅ |
| Optical power role boundary | 3 | ✅ |
| Phase 3 cross-clinic isolation | 4 | ✅ |
| Prescription snapshot integrity | 4 | ✅ |

Results worth noting:

- **ADMIN, FRONT_DESK and OPTOMETRIST all refused consultation inserts with
  `42501`** — the DOCTOR-only rule is enforced in the database, not by hiding a
  button.
- **FRONT_DESK reads zero rows from `medicines`** — the read restriction holds,
  not just the write one.
- **`medicine_name_snapshot` survived renaming the master record.** The test
  prescribes "Probe Aspirin", renames the medicine to "Renamed Aspirin", and
  confirms the prescription still reads "Probe Aspirin" while the master shows
  the new name. That is the property that keeps historical prescriptions
  truthful.
- **Walk-in consultation with no `appointment_id` accepted**, confirming the
  nullable-plus-UNIQUE arrangement works.

### Application smoke test

| Route | Signed out |
|---|---|
| `/login` | 200 |
| `/consultations`, `/consultations/new`, `/medicines` | 307 → `/login` |
| `/consultations/[id]/print` | 307 → `/login` |

The print route redirecting matters: it renders diagnoses, prescriptions and
optical measurements, so it must never be reachable without a session.

### Not verified

The browser click-through — opening a consultation, typing a diagnosis,
prescribing, recording optical power, and confirming the printed letter lays out
correctly. **Print layout in particular has never been seen rendered**, only
built. Checklist in `docs/setup.md`.

---

## 7. Open items

Tracked in [`summary/open-items.md`](open-items.md) for decision after the final
phase, per instruction. Phase 3 added one entry (optical gating outside RLS) and
closed one (Phase 3 runtime verification).

---

## 8. References

- Phase 1 — [`summary/phase1_implementation.md`](phase1_implementation.md)
- Phase 2 — [`summary/phase2_implementation.md`](phase2_implementation.md)
- Open items — [`summary/open-items.md`](open-items.md)
- Pending plan — [`summary/plan-profile-and-history.md`](plan-profile-and-history.md)
- Setup & verification — [`docs/setup.md`](../docs/setup.md)
