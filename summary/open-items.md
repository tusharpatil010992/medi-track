# Open Items

Running log of things flagged during implementation and **deferred by decision
until after the final phase**. Nothing here is blocking; each is recorded so it
is decided deliberately rather than forgotten.

Last updated: 2026-08-16 (during Phase 3)

---

## 1. Double-booking race condition
**Raised:** Phase 2 · **Severity:** low today, grows with volume

The appointment conflict check reads existing bookings, then writes. Two
simultaneous bookings for the same slot could both pass.

**Fix when needed:** a `btree_gist` exclusion constraint over a time range, so
the database rejects the overlap regardless of timing. Deferred as
over-engineering at current volume.

*Where:* `src/features/appointments/actions.ts` → `validateSlot()`

---

## 2. Optical power gating is not enforced by RLS
**Raised:** Phase 3 · **Severity:** by design, but worth knowing

"Show optical power only for an ophthalmologist" reads `profiles.specialty`,
which is free text and cannot be matched reliably inside a policy.

Split deliberately:
- **RLS** enforces role — only DOCTOR and OPTOMETRIST may write `optical_power`
- **Server action + UI** enforce specialty — `recordsOpticalPower()`

The specialty test is a workflow convenience, **not** a security boundary. A
doctor whose specialty does not contain "ophthalm" simply will not see the
section. ADMINs need to know that field drives behaviour.

*Where:* `src/types/user.ts` → `recordsOpticalPower()`

---

## 3. OPTOMETRIST cannot be booked
**Raised:** Phase 2 · **Resolved by decision in Phase 3**

Optometrists have no bookable availability. Per the Phase 3 decision — *"their
job is just to measure the optical power and save them"* — this is intended,
not a gap. Recorded in case the clinic later wants optometrist-led appointments.

---

## 4. `patient_history` name means two different things
**Raised:** Phase 3 · **Severity:** cosmetic, but a genuine trip hazard

- `patient_history` **table** (0002) — change-audit trail of edits to a patient record
- `consultations.patient_history` **column** (0003) — free-text clinical history for one visit

Both are documented, and both follow the source docs, but the shared name
invites confusion. Renaming either is a breaking change; deferred.

---

## 5. Unused connection-pool config
**Raised:** Phase 1 · **Severity:** cosmetic

`dbConfig.pool` (min/max/idleTimeout) is documented and populated from env, but
supabase-js talks to PostgREST over HTTP and holds no TCP pool, so nothing reads
it. Kept because it is specified in `docs/database.md`; marked "reserved" in
`.env.example`.

*Where:* `src/db/config.ts`

---

## 6. No browser click-through has been performed
**Raised:** Phase 1, still true through Phase 3 · **Severity:** medium

Every phase has been verified by static checks plus the automated isolation
suite against the live database. **Nobody has driven the actual screens.** The
suite exercises RLS and server-side rules; it does not click a button, submit a
form, or confirm the print layout renders correctly.

Manual checklist lives in `docs/setup.md`.

---

## 7. Credential hygiene
**Raised:** Phase 1 · **Severity:** worth doing

- The SUPER_ADMIN password was generated in-session and appears in the chat
  transcript. **Rotate it** — now self-service at `/profile`.
- `plan/secrets.txt` holds the Supabase **database password** and direct
  connection string. It is gitignored and has never been committed, but it sits
  inside the project folder, where an accidental zip or screen-share would
  expose it. Consider moving it outside the repo.

---

## 8. Printed letter — footer and plain paper
**Raised:** Phase 3 (post-review) · **Severity:** low, needs a decision

The clinic header was removed from the printed letter so it sits on pre-printed
stationery, and the gap is now per-clinic (`clinics.letterhead_gap_percent`,
default 12%). Two loose ends remain:

- **The footer still prints** — doctor name, specialty, registration number and
  signature line. Many letterheads carry a footer band (address, registration
  details) that this could collide with. Only the header was raised, so the
  footer was left alone. The same percentage approach would work from the bottom.
- **Plain-paper clinics get an unbranded letter.** Setting the gap to 0 removes
  the blank space, but nothing then identifies the clinic on the page. If this
  matters, the fix is a per-clinic "print clinic header" toggle rather than a
  global choice, since it varies by clinic.

---

## 9. Password recovery still has no self-service path
**Raised:** Phase 3 · **Severity:** low, closes in Phase 4

`/profile` now lets any user change their own password, and an ADMIN can issue a
temporary one for staff in their clinic. Two gaps remain by design:

- **No email-based "forgot password"** — needs Resend, which arrives in Phase 4.
- **A locked-out clinic ADMIN still needs the Supabase dashboard.** An ADMIN
  cannot reset another ADMIN (peers should not be able to seize each other's
  accounts), and SUPER_ADMIN reset was offered but not chosen.

---

## Resolved

| Item | Phase | Outcome |
|---|---|---|
| RLS infinite recursion on `profiles` | 1 | Fixed — `SECURITY DEFINER` on helper functions |
| `WITH CHECK` missing from write policies | 1 | Fixed — added to every write policy |
| `clinic_config` secrets readable clinic-wide | 1 | Fixed — scoped to ADMIN + SUPER_ADMIN |
| `patients` had no name column | 2 | Fixed — `first_name` + `last_name` |
| `appointment_status` had no `CHECKED_IN` | 2 | Fixed — added with `CONFIRMED` |
| `optical_power` had no ADD field | 3 | Fixed — `right_eye_add` + `left_eye_add` |
| False alarm: Phase 3–5 tables appeared present | 2 | Disproved — the probe used `head:true`, masking a `PGRST205` |
| Phase 3 runtime verification pending | 3 | Done — migration 0003 applied, 44/44 passing |
| No way to change your own password | 3 | Done — `/profile` plus ADMIN reset, 46/46 passing |
| Per-visit history not visible on later visits | 3 | Done — earlier entries shown date-wise, no schema change |
