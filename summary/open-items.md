# Open Items

Running log of things flagged during implementation and **deferred by decision
until after the final phase**. Nothing here is blocking; each is recorded so it
is decided deliberately rather than forgotten.

Last updated: 2026-08-16 (post Phase 4, after the consultation → billing amendment)

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
**Raised:** Phase 1, still true through Phase 4 · **Severity:** medium

Every phase has been verified by static checks plus the automated isolation
suite against the live database. **Nobody has driven the actual screens.** The
suite exercises RLS and server-side rules; it does not click a button, submit a
form, or confirm the print layout renders correctly.

Phase 4 widened this: the invoice and receipt layouts have never been seen
rendered, and no notification has ever reached a real provider, since the test
clinic runs on placeholder credentials.

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
**Raised:** Phase 3 · **Severity:** low · **Still open after Phase 4**

`/profile` lets any user change their own password, and an ADMIN can issue a
temporary one for staff in their clinic. Two gaps remain:

- **No email-based "forgot password".** This was expected to close in Phase 4
  once Resend arrived. It did not: the notification service sends *patient*
  messages, and password reset is a Supabase Auth flow
  (`resetPasswordForEmail` plus a callback route), not a clinic-configured
  Resend send. Nothing in Phase 4 required it, so it was not built. It is a
  small, self-contained piece of work whenever it is wanted.
- **A locked-out clinic ADMIN still needs the Supabase dashboard.** An ADMIN
  cannot reset another ADMIN (peers should not be able to seize each other's
  accounts), and SUPER_ADMIN reset was offered but not chosen.

---

## 10. Concurrent payments can overdraw an invoice
**Raised:** Phase 4 · **Severity:** low today, real if two desks collect at once

`recordPayment()` reads the invoice balance, checks the amount against it, then
inserts. Two payments submitted simultaneously could both pass the check and
together exceed the total. The stored `paid_amount` stays truthful — it is
re-summed from the payments table rather than incremented — so the invoice would
show a **negative balance** rather than losing money.

Same shape as the double-booking race in item 1, and the same fix applies: move
the constraint into the database, here as a deferred CHECK or a guarded update
of `invoices.paid_amount`. Deferred as over-engineering at a single counter.

*Where:* `src/features/billing/actions.ts` → `recordPayment()`

---

## 11. No refund path
**Raised:** Phase 4 · **Severity:** by design, but it will come up

Payments are immutable, and cancelling or voiding an invoice requires
`paid_amount = 0`. So an invoice that was **paid in error cannot be reversed
in the application at all** — the only routes are a correcting entry made
outside the system, or a database edit.

This is the deliberate consequence of treating money received as a historical
fact, and no requirement asked for refunds. If a clinic needs them, the shape
that preserves the ledger is a negative-amount payment row with its own reason,
rather than deleting or editing the original.

---

## 12. APPOINTMENT_REMINDER is defined but never sent
**Raised:** Phase 4 · **Severity:** low, needs a decision

The enum value, the template and the log all exist; nothing fires them. It is
the only notification event needing a scheduler, and Vercel Cron was explicitly
left out of Phase 4 scope.

When wanted: `/api/cron/appointment-reminders` guarded by a `CRON_SECRET`, plus
a `vercel.json` cron entry. `docs/architecture.md` already permits Vercel
scheduled jobs, so this needs no architectural change — only the decision and
the deployment config.

`PRESCRIPTION_ISSUED` is similarly defined but unwired, for a different reason:
it would fire on every re-save of a prescription, which is noise.

---

## 13. A completed consultation can be billed more than once
**Raised:** post-Phase 4 amendment · **Severity:** low, but it is now reachable

The billing button on a consultation reads "Open invoice" once a live invoice
exists, so the ordinary path raises exactly one. But nothing stops someone
navigating straight to `/billing/invoices/new?consultation=<id>` and raising a
second, and the completion gate only ever inspects the **latest** invoice for
the visit — so an earlier unpaid one would not hold the appointment open.

The clean fix is a partial unique index: at most one invoice per consultation
whose status is not CANCELLED or VOID. That is a migration plus a decision about
what should happen when a clinic genuinely wants to split a visit across two
bills, so it was not made unilaterally.

*Where:* `src/app/(dashboard)/billing/invoices/new/page.tsx`

---

## 14. Walk-in consultations have no appointment to gate
**Raised:** post-Phase 4 amendment · **Severity:** by design, worth knowing

The billing gate lives on appointment completion. A **walk-in** consultation has
no appointment (`appointment_id` is NULL), so nothing enforces that its bill is
settled — the consultation simply completes and the visit has no closing step.

The bill is still raised the same way and still appears in billing and on the
patient's history; what is absent is the *refusal* that stops an unpaid visit
being marked finished, because there is no appointment to mark. If walk-ins turn
out to be a common billing route, the gate needs a second home — most likely
refusing to let a walk-in consultation leave IN_PROGRESS until settled, which
reintroduces the deadlock unless the button appears earlier for walk-ins only.

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
| Clinic deactivation was cosmetic | post-3 | Fixed — suspends the whole clinic, 62/62 ([detail](clinic-deactivation-rule.md)) |
| Re-invoicing a cancelled visit was a dead end | 4 | Fixed pre-release — `maybeSingle()` on a visit's invoice errored once a second existed; now takes the latest, 106/106 |
