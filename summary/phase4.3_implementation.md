# Phase 4.3 — Clinic-defined consultation notes

> The five fixed clinical textareas on a consultation are gone. A doctor now
> adds any number of notes, each a **field + free text + "show on printed
> letter"**, and the field list itself is clinic master data that ADMIN and
> DOCTOR maintain.

**Status:** Complete. Migration `0008` applied; 139/139 isolation tests passing.
**Date:** 2026-08-19
**Scope:** consultations only. No Phase 5 work, no billing change, no
notification change.

---

## 1. What changed

| Before | After |
|---|---|
| Chief complaint, History, Examination findings, Diagnosis, Treatment plan — five fixed textareas on every consultation | Any number of notes, each against a field the clinic chose |
| The same five fields for every clinic, set in a `.tsx` file | `consultation_note_types`, per clinic, editable at `/note-types` |
| The letter always printed Diagnosis and Notes | The letter prints exactly the notes ticked for it, each under its own field heading |
| Prior visits showed the `patient_history` column | Prior visits show all their notes, grouped by date, under their field names |
| The consultations list carried a Diagnosis column | Column removed — there is no fixed diagnosis field left to summarise |

## 2. Schema — migration `0008_phase4.3_consultation_notes.sql`

**`consultation_note_types`** — the dropdown. Clinic-owned, `UNIQUE(clinic_id,
name)`, `display_order`, `is_active`. Seeded with the five labels the form used
to hard-code: for existing clinics by the migration, for new ones by
`createClinic()`.

**`consultation_notes`** — one row per note: `clinic_id`, `consultation_id`,
`patient_id`, `note_type_id`, `note_type_snapshot`, `content`,
`show_on_receipt`, `display_order`, `is_active`.

`patient_id` is denormalised from the consultation so reading a patient's notes
across visits needs no join. `note_type_snapshot` repeats the property
`prescription_items.medicine_name_snapshot` already carries — renaming
"Diagnosis" must never rewrite a letter already handed to a patient. Both are
asserted by the suite.

### RLS

| Table | SELECT | INSERT / UPDATE | DELETE |
|---|---|---|---|
| `consultation_note_types` | clinic-wide | ADMIN, **DOCTOR** | none |
| `consultation_notes` | clinic-wide | DOCTOR | none |

Two choices worth naming:

- **DOCTOR maintains the dropdown**, unlike `medicines` and `billing_services`
  which are ADMIN-only. Asked for directly, and it is the right shape: the
  clinicians filling the fields in are the ones who know what belongs there.
- **Field labels are readable clinic-wide**, not restricted the way `medicines`
  is to ADMIN/DOCTOR/OPTOMETRIST. These are labels, not clinical content, and
  every role that can open a consultation needs them to render its notes.

## 3. The soft-delete decision, and what it cost

`prescription_items` is replaced wholesale on every save: delete the lot,
reinsert. It was the obvious model to copy, and it needs a DELETE policy —
which Rule 6 forbids and which Phase 3 justified as an exception.

**That exception was not reused.** Neither new table has a DELETE policy at all.
Removing a note from the form sets `is_active = FALSE`.

The cost lands in `saveConsultationNotes()`, which reconciles by row identity
instead of replacing: existing rows are updated in place, genuinely new rows
inserted, and rows the doctor removed deactivated. Roughly 30 lines rather than
10, one extra read, and rows keep their `created_at`. The suite asserts a
DOCTOR's `DELETE` matches zero rows, so the boundary is real rather than a
convention the next change could quietly drop.

## 4. The destructive step

Migration 0008 ends with:

```sql
UPDATE consultations
SET chief_complaint = NULL, patient_history = NULL,
    examination_findings = NULL, diagnosis = NULL, treatment_plan = NULL,
    updated_at = NOW();
```

Every clinical note recorded through Phase 4.2, in every clinic, destroyed.
Authorised explicitly — those columns are superseded and no production patient
data existed — but it is unrecoverable without a point-in-time restore, so the
file carries a banner and `docs/setup.md` repeats the warning at the step that
runs it. Verified against the live database afterwards: 3 consultations, 0 rows
still holding data in any of the five.

The **columns themselves stay**. Dropping them would be irreversible, and they
may yet be wanted; `COMMENT ON COLUMN` marks each one RESERVED in the database
itself, alongside the note in `docs/database.md` and `src/types/clinical.ts`.

## 5. Form mechanics worth knowing

The notes form posts four parallel arrays — `note_id`, `note_type_id`,
`content`, `show_on_receipt` — one entry per visible row, matched by index on
the server.

A real checkbox posts **nothing** when unchecked, which would shift every later
row's flag onto the wrong note. So the checkbox is a controlled MUI `Checkbox`
plus a hidden input that always submits `"true"` or `"false"`. Same reasoning
for `note_id`, which is empty on a row that has not been saved yet.

An empty row is how a doctor clears a note, so it is treated as a removal rather
than as a validation error. A row with text but no field chosen is refused.

## 6. Files

### Migration
```
supabase/migrations/0008_phase4.3_consultation_notes.sql   2 tables · 6 RLS policies · seed · the clearing
```

### Server actions
```
src/features/consultation-notes/actions.ts   saveConsultationNotes — reconcile, never delete
src/features/note-types/actions.ts           createNoteType, setNoteTypeActive
src/features/consultations/actions.ts        updateConsultation stops writing the five columns
src/features/clinics/actions.ts              new clinics seeded with the default fields
```

### UI
```
src/app/(dashboard)/note-types/page.tsx           the master, shaped like /medicines
src/components/note-types/NoteTypeForm.tsx        add a field
src/components/note-types/NoteTypeStatusToggle.tsx  deactivate / reactivate
src/components/consultations/ConsultationNotesForm.tsx  the add-more section
src/components/consultations/PreviousHistory.tsx  prior visits' notes, grouped by visit
src/components/consultations/ConsultationDetailsForm.tsx  reduced to follow-up
src/app/(dashboard)/consultations/[id]/page.tsx   notes, fields, prior-visit notes
src/app/(dashboard)/consultations/page.tsx        Diagnosis column removed
src/app/consultations/[id]/print/page.tsx         prints the ticked notes
src/config/navigation.ts + src/components/layout/AppShell.tsx  the new link and its icon
src/types/clinical.ts                             ConsultationNote, ConsultationNoteType, DEFAULT_NOTE_TYPES
src/types/user.ts                                 NOTE_TYPE_MANAGING_ROLES
```

`DEFAULT_NOTE_TYPES` lives in `src/types/clinical.ts` rather than in the actions
file because a `"use server"` module may export nothing but async functions.

## 7. Verification

### Static
```
npm run type-check   ✓
npm run lint         ✓
npm run build        ✓  29 routes + middleware (/note-types added)
```

### Isolation and behaviour — 139/139

`npm run verify:isolation`. Phases 1–4 regress in full on every run; Phase 4.3
added 20 checks and one existing check was rewritten.

| Group | Tests | Result |
|---|---|---|
| Phases 1–4 regression | 119 | ✅ |
| The dropdown is ADMIN and DOCTOR managed | 7 | ✅ |
| Notes are DOCTOR-write | 6 | ✅ |
| Snapshot integrity and the printed letter | 3 | ✅ |
| Phase 4.3 cross-clinic isolation | 4 | ✅ |

Results worth noting:

- **ADMIN, FRONT_DESK and OPTOMETRIST are all refused note inserts with
  `42501`** — clinical content stays DOCTOR-write in the database.
- **ADMIN and DOCTOR are both accepted on the field list, FRONT_DESK and
  OPTOMETRIST both refused.** The one master table that is not ADMIN-only
  behaves as specified.
- **A DOCTOR's `DELETE` on a note matches zero rows**, while the same doctor's
  `is_active = false` succeeds. Soft delete is enforced, not just intended.
- **A note keeps `Probe Diagnosis` after its field is renamed to
  `Renamed Diagnosis`**, and the master shows the new name — the Phase 3
  snapshot property, repeated for notes.
- **Two notes on a visit, one ticked: the print query returns exactly one.**
- **FRONT_DESK reads the field list but writes nothing to it**, which is what
  lets a non-clinical role render a consultation's notes.

The old prior-history check read `consultations.patient_history`, now a reserved
column, and was rewritten to assert the prior-**visit** lookup stays inside the
clinic. The notes those visits carry are asserted in the Phase 4.3 block.

### Defect found and fixed during self-review

**Saving twice would have duplicated every newly added note.**

`ConsultationNotesForm` seeds its rows from `useState`, whose initialiser runs
only on mount. A row the doctor adds carries `id: ""` until the server allocates
one. After a save, `revalidatePath` re-renders the page and passes the saved
notes down — but the initialiser does not run again, so the row kept its empty
id. A second Save on the same screen would post that empty id, the reconciler
would find no match in `existingIds`, and the note would be inserted a second
time.

`PrescriptionForm`, which this form was modelled on, is immune only because it
deletes every row and reinserts. Reconciling instead of replacing — the soft
delete decision in §3 — is exactly what introduced the exposure.

Fixed by re-seeding the rows whenever the saved ids change, using React's
documented reset-on-prop-change pattern rather than a `key` on the component, so
the "Notes saved" confirmation is not wiped by a remount.

This is only reachable by clicking Save twice without navigating away, so no
automated check caught it and none covers it now — the suite never renders a
component. It is on the manual checklist.

### Application smoke test

| Route | Signed out |
|---|---|
| `/login` | 200 |
| `/note-types` | 307 → `/login` |
| `/consultations` | 307 → `/login` |

Migration 0008 was confirmed applied against the live database before the run:
`consultation_note_types` holds the five seeded fields for the one real clinic,
`consultation_notes` is empty, and no consultation still holds data in any of
the five reserved columns.

### Not verified

The browser click-through — unchanged from every earlier phase, and now covering
this work too. **Nobody has typed a note, ticked the box, or seen the letter
render.** Specifically unproven: that the add/remove row interaction behaves,
that a cleared note disappears and stays deactivated, that a deactivated field
still renders on the note using it, and that the printed letter lays out
correctly with several note sections. Checklist in `docs/setup.md`; this is
standing open item 6.

## 8. Open items

Two added, both recorded in [`summary/open-items.md`](open-items.md):

- **15** — any doctor can rename a field their colleagues use. Bounded by the
  snapshot, but it is a shared list.
- **16** — note writes are owner-gated in the UI, not in RLS, exactly as the
  rest of the consultation already was.

Item **4** (`patient_history` meaning two things) is largely defused: the column
is now reserved and unread, so only one live meaning remains.

## 9. References

- Phase 3 — [`summary/phase3_implementation.md`](phase3_implementation.md)
- Phase 4 — [`summary/phase4_implementation.md`](phase4_implementation.md)
- Open items — [`summary/open-items.md`](open-items.md)
- Setup & verification — [`docs/setup.md`](../docs/setup.md)
