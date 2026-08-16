# Clinic Deactivation — What It Does

**Status:** Implemented and verified. Migration `0005` applied; 62/62 isolation tests passing.
**Date:** 2026-08-16
**Scope:** Not part of the 5-phase roadmap — a defect found while reviewing SUPER_ADMIN behaviour.

---

## 1. The problem

SUPER_ADMIN has always had a Deactivate button on `/clinics`. It set
`clinics.is_active = FALSE`, stamped `updated_at`, and refreshed the list so the
chip read "Inactive".

**Nothing else happened.** No RLS policy and no application code read that flag.
Tracing every reader of `clinics.is_active` turned up only the status chip and
the toggle button itself.

Confirmed against the live database before any change was made:

| | Clinic active | Clinic deactivated |
|---|---|---|
| Front desk signs in | OK | **still OK** |
| Reads patients | 1 row | **still 1 row** |
| Creates a patient | — | **still allowed** |

A "deactivated" clinic carried on operating exactly as before. The label
changed; the behaviour did not.

### Why it went unnoticed

Phase 1 delivered "activate/deactivate clinics" as a requirement, and the
isolation suite verifies **tenant boundaries** — Clinic A must not reach Clinic
B. It never asserted that deactivation *does* anything. So 51 passing tests said
nothing about it. Suspension is a lifecycle rule, not an isolation rule, and
nothing was testing that category.

---

## 2. The fix

One function. All 35 RLS policies resolve tenancy through
`get_user_clinic_id()`, so gating that single choke point suspends the clinic
everywhere at once — across every table, in every phase, with no policy needing
to change.

```sql
CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS UUID
LANGUAGE SQL STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.clinic_id
  FROM profiles p
  JOIN clinics c ON c.id = p.clinic_id
  WHERE p.id = auth.uid()
    AND p.is_active = TRUE
    AND c.is_active = TRUE;   -- the new condition
$$;
```

A suspended clinic makes this return NULL. Because `clinic_id = NULL` evaluates
to NULL rather than TRUE, every clinic-scoped read and write yields zero rows.
The same NULL-comparison quirk that already keeps SUPER_ADMIN out of clinic data
now does the suspension work too.

### A second function, and why it was necessary

Once a clinic is suspended, its users can no longer read even their own
`clinics` row — `clinics_select` also routes through `get_user_clinic_id()`. The
application would therefore have no way to tell "your clinic is suspended" from
"you have no data", and a locked-out user would just see blank screens.

```sql
CREATE OR REPLACE FUNCTION current_user_clinic_is_active()
RETURNS BOOLEAN
LANGUAGE SQL STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.is_active FROM profiles p JOIN clinics c ON c.id = p.clinic_id
     WHERE p.id = auth.uid()),
    TRUE   -- no clinic (SUPER_ADMIN) is never suspended by this mechanism
  );
$$;
```

Used at sign-in and on every request, so the message is specific:

> This clinic is currently suspended. Contact your platform administrator.

Kept distinct from the account-level message, so the person on the phone is told
something true — this is not something they can fix themselves.

---

## 3. Behaviour

| Question | Answer |
|---|---|
| Blocks sign-in for every user in the clinic? | Yes |
| Including that clinic's own ADMIN? | **Yes** |
| Applies to sessions already open? | Yes, from the next request |
| Does it change `profiles.is_active` for those users? | **No** |
| Can SUPER_ADMIN reverse it? | Yes |
| Does reactivating revive individually disabled users? | **No** |

The two "no" rows are the important ones.

Suspension **gates** on the clinic's flag rather than flipping each user's own
flag. That has a consequence worth stating plainly: reactivating a clinic
restores exactly the users who were enabled beforehand. Anyone an ADMIN had
individually deactivated stays deactivated. Had suspension worked by bulk-writing
`profiles.is_active = FALSE`, reactivation would have had no way to tell those
two groups apart and would have silently re-enabled people who were meant to
stay out.

SUPER_ADMIN is unaffected throughout: their `clinic_id` is NULL so they never
satisfy the join, and `is_super_admin()` does not consult clinic state. Without
that, deactivation would be irreversible.

### One thing that is *not* blocked

A suspended user can still read **their own profile row**. That is deliberate:
`profiles_select` grants `id = auth.uid()` before any clinic test, because
without it session bootstrap could never load anyone — including SUPER_ADMIN,
whose NULL `clinic_id` matches nothing. It is their own row, no one else's, and
the application refuses the session regardless.

---

## 4. Files

```
supabase/migrations/0005_clinic_deactivation.sql   replaces 1 function, adds 1
src/lib/auth/session.ts                            rejects suspended-clinic sessions
src/features/auth/actions.ts                       distinct sign-in message
scripts/verify-isolation.mjs                       11 new checks
docs/database.md                                   semantics + updated helper
docs/setup.md                                      migration list + manual checks
```

No table changes. No policy changes. No UI changes — the toggle already existed.
No new dependency.

---

## 5. Verification

```
npm run type-check   ✓
npm run lint         ✓
npm run build        ✓
npm run verify:isolation   62/62   (was 51)
```

| Check | Result |
|---|---|
| Before: FRONT_DESK reads patients | ✅ baseline |
| After: existing session reads no patients | ✅ 0 rows |
| After: writes rejected | ✅ `42501` |
| After: DOCTOR reads no consultations | ✅ |
| After: clinic's own ADMIN cannot see other users | ✅ 0 rows |
| After: clinic's own ADMIN reads no patients | ✅ |
| After: clinic's own ADMIN refused by the app layer | ✅ |
| After: fresh sign-in reports clinic inactive | ✅ |
| After: clinic still visible at platform level | ✅ reversible |
| Reactivation restores access immediately | ✅ |
| Reactivation does not revive individually disabled users | ✅ |

### A test that failed first, correctly

The first run came back **59 passed, 1 failed**: "clinic's own ADMIN is locked
out too" returned 1 row instead of 0.

Rather than adjust the assertion to make it pass, the discrepancy was
investigated directly against the database. The single row was the ADMIN's *own
profile* — other users' profiles returned 0, patients returned 0, and
`current_user_clinic_is_active()` returned false. The implementation was right;
the assertion was too broad, treating "reads nothing at all" as the requirement
when the real requirement is "reads nothing belonging to anyone else".

The assertion was replaced with three narrower ones that state the actual rule.
Worth recording because a test that is too strict is the useful kind of wrong —
it surfaced a real nuance in the policy design instead of hiding it.

### Not verified

The browser click-through: deactivating from `/clinics`, watching a signed-in
user get bounced on their next click, and reading the suspension message on the
login screen. Server-side behaviour is covered above; the screens have not been
driven. Checklist is in `docs/setup.md`.

---

## 6. Related

- Open items — [`open-items.md`](open-items.md)
- Database & RLS — [`../docs/database.md`](../docs/database.md) → *Clinic deactivation*
- Setup & verification — [`../docs/setup.md`](../docs/setup.md)
