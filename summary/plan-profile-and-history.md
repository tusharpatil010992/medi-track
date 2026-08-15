# Plan — Profile / Password & Per-Visit History Display

Two additions requested during Phase 3. Neither is part of the original 5-phase
roadmap; both are small and self-contained.

Status: **implemented** (2026-08-16). Retained as the design record.

---

## A. Medical history — no schema change needed

### What was asked
> "It should be per visit each time doctor will enter patient's medical history,
> and on each subsequent visit this detail shall be shown datewise if present."

### What already exists
`consultations.patient_history` (TEXT, nullable) — migration 0003. The doctor
already records history per visit, in the consultation workspace. Per the
"ignore if already present" instruction, **no field is added.**

Worth distinguishing from two similarly-named things:

| Name | What it is |
|---|---|
| `consultations.patient_history` (column) | Per-visit clinical history — **this is the one** |
| `patient_history` (table) | Change-audit trail of edits to a patient record — unrelated |

### What is missing
The *datewise display*. Today a doctor sees only the history typed in the
current consultation; earlier visits are invisible without leaving the page.

### Work
One read-only component above the consultation form:

- `src/components/consultations/PreviousHistory.tsx`
- Rendered in `src/app/(dashboard)/consultations/[id]/page.tsx`

Query — prior consultations for the same patient that actually have history:

```ts
supabase.from("consultations")
  .select("id, consultation_date, patient_history")
  .eq("clinic_id", clinicId)
  .eq("patient_id", consultation.patient_id)
  .neq("id", consultation.id)
  .not("patient_history", "is", null)
  .order("consultation_date", { ascending: false })
  .limit(10)
```

Rendered newest-first, each entry headed by its consultation date, collapsed
beyond the most recent two so the page stays readable. Hidden entirely when the
patient has no prior history — no empty box.

Visible to anyone who can already open the consultation; RLS scopes it to the
clinic automatically. Read-only for everyone, including the author.

**No migration. No RLS change.**

---

## B. Profile section with password change

### Why it matters now
Every account is created with a temporary password shown exactly once. There is
currently **no way for anyone to change their own password**, and no recovery
path at all — Resend email is not wired until Phase 4. A forgotten password
today means editing the user in the Supabase dashboard.

This also closes a live item: the SUPER_ADMIN password was generated in-session
and sits in the chat transcript. It should be rotated, and this makes that
self-service.

### B1. `/profile` — self-service, all roles

`src/app/(dashboard)/profile/page.tsx` — shows name, email, role and clinic
(read-only), plus a change-password form.

`src/features/profile/actions.ts` → `changePassword`:

1. `requireProfile()` — any signed-in user
2. Validate: new password ≥ 8 chars, confirmation matches, new ≠ current
3. **Re-authenticate** — call `signInWithPassword(profile.email, currentPassword)`
   before changing anything. Supabase's `updateUser` does not require the
   current password, so without this step anyone with a hijacked session could
   silently take over the account. Verifying possession of the current password
   is the point of the flow.
4. `supabase.auth.updateUser({ password })`
5. Generic failure message — never reveal whether the current password was the
   part that was wrong

Navigation: **Profile** entry added for every role.

### B2. ADMIN password reset — closes the lockout gap

An action on `/users`, per user, in the ADMIN's own clinic.

`src/features/users/actions.ts` → `resetUserPassword(userId)`:

1. `requireRole(["ADMIN"])`, then `requireClinicId(profile)`
2. Re-read the target user filtered by `clinic_id` — an id from another clinic
   resolves to nothing, so a guessed UUID cannot reach across tenants
3. Refuse when `userId === profile.id` — an ADMIN changes their own password at
   `/profile`, where the current password is required. Allowing self-reset here
   would let a hijacked session bypass that check.
4. Refuse to reset another ADMIN — an ADMIN should not be able to seize a peer's
   account
5. Service-role `auth.admin.updateUserById(userId, { password: temp })`
6. Return the temporary password, displayed **once**, matching how credentials
   are already handed over at user creation

### Not included
- Email-based "forgot password" — needs Resend, which is Phase 4
- Password complexity beyond a length floor — no library, per the dependency rule
- Forced rotation, history, or expiry — not requested
- SUPER_ADMIN resetting a clinic ADMIN — offered but not chosen; if a clinic's
  only ADMIN is locked out, that is still a Supabase-dashboard job

---

## Files

```
New
  src/app/(dashboard)/profile/page.tsx
  src/components/profile/ChangePasswordForm.tsx
  src/components/consultations/PreviousHistory.tsx
  src/features/profile/actions.ts

Modified
  src/app/(dashboard)/consultations/[id]/page.tsx   render PreviousHistory
  src/app/(dashboard)/users/page.tsx                reset action per row
  src/features/users/actions.ts                     resetUserPassword
  src/config/navigation.ts                          Profile for every role
  src/components/layout/AppShell.tsx                profile icon
```

No migration. No RLS change. No new dependency.

---

## Verification

1. `npm run type-check`, `npm run lint`, `npm run build`
2. Extend `scripts/verify-isolation.mjs`:
   - ADMIN cannot reset a password for a user in another clinic
   - ADMIN cannot reset another ADMIN's password
   - ADMIN cannot reset their own password through the admin path
   - Prior-history query returns only same-clinic, same-patient rows
3. Manual, since password flows cannot be asserted from the isolation suite:
   - Change own password, sign out, sign in with the new one
   - Wrong current password is rejected
   - ADMIN resets a doctor's password; doctor signs in with the temp one
   - Consultation shows earlier visits' history date-ordered; hidden when none

---

## Sequencing

Both are independent of Phase 4. Recommended order:

1. Finish Phase 3 verification first — migration 0003 is still unapplied, so the
   44-check suite has not run
2. Then these two, as a single small change set
3. Then Phase 4

Doing these before Phase 3 is signed off would mix unverified work with new work.
