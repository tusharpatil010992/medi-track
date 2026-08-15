# Phase 1 — Implementation Summary

**Scope:** Foundation, Multi-Tenancy & Clinic Users
**Status:** Complete. Schema applied; tenant isolation verified 10/10 against the live database.
**Date:** 2026-08-15

---

## 1. What was delivered

| Phase 1 requirement (`docs/requirements.md`) | Delivered |
|---|---|
| Shared login page for all roles | `/login` — one page, role resolved from profile after auth |
| Supabase Auth integration | Cookie-based SSR auth + middleware session refresh |
| Clinic creation and management (SUPER_ADMIN) | `/clinics`, `/clinics/new`, activate/deactivate |
| Automatic ADMIN provisioning per clinic | Part of clinic creation, with compensating rollback |
| Clinic configuration management | `/settings` — ADMIN only, secrets never sent to browser |
| Role-based user creation (ADMIN creates staff) | `/users`, `/users/new` — Doctor, Optometrist, Staff, Front Desk |
| Role-based navigation shell | `src/config/navigation.ts` + responsive `AppShell` |
| Multi-tenant RLS enforcement | `0001_phase1_foundation.sql` — policies on all three tables |

Deliberately **not** built: patients, appointments, consultations, medicines,
prescriptions, billing, notifications, documents, audit logs. Those belong to
Phases 2–5.

---

## 2. Stack as installed

| Package | Version |
|---|---|
| Next.js | 15.5.23 (App Router) |
| React | 19.2.8 |
| MUI | 6.5.0 |
| @supabase/supabase-js | 2.x |
| @supabase/ssr | 0.5.2 |
| TypeScript | 5.7 (strict, `noUncheckedIndexedAccess`) |

No library outside the documented stack was introduced. `@supabase/ssr` is
Supabase's official Next.js adapter, required for cookie-based auth in the App
Router.

---

## 3. File inventory

### Database
```
supabase/migrations/0001_phase1_foundation.sql
```
`user_role` enum · `clinics` · `clinic_config` · `profiles` · 3 RLS helper
functions · RLS policies · indexes. No triggers, per `docs/database.md`.

### Core
```
src/db/config.ts                  Universal DB config + validateDbConfig()
src/lib/supabase/client.ts        Browser client (anon key, RLS applies)
src/lib/supabase/server.ts        Server client (anon key, RLS applies)
src/lib/supabase/admin.ts         Service-role client (BYPASSES RLS)
src/lib/auth/session.ts           getCurrentProfile / requireProfile / requireRole / requireClinicId
src/middleware.ts                 Session refresh + signed-out redirect
```

### Server Actions (all mutations)
```
src/features/auth/actions.ts           login, logout
src/features/clinics/actions.ts        createClinic, setClinicActive
src/features/users/actions.ts          createClinicUser, setUserActive
src/features/clinic-config/actions.ts  updateClinicConfig
```

### UI
```
src/themes/index.ts               Light + dark palettes, typography scale
src/config/navigation.ts          Role → nav items
src/components/layout/AppShell.tsx
src/components/common/            SubmitButton, EmptyState, StatusChip
src/app/login/                    Shared login
src/app/(dashboard)/              dashboard, clinics, users, settings
```

35 source files total.

---

## 4. How tenant isolation is enforced

Three independent layers. Each assumes the others may fail.

**Layer 1 — Session.** `src/lib/auth/session.ts` is the only place tenant
context originates. `getCurrentProfile()` calls `supabase.auth.getUser()`, which
revalidates the JWT against Supabase, rather than `getSession()`, which only
reads a cookie the client could tamper with. Deactivated accounts return null.

**Layer 2 — Server Actions.** Every action opens with `requireRole([...])` and
derives `clinic_id` from the returned profile. No action reads `clinic_id` from
`FormData`. Verified by grep: zero occurrences of `formData.get("clinic_id")`.

**Layer 3 — RLS.** Policies on `clinics`, `clinic_config` and `profiles` gate
both reads (`USING`) and writes (`WITH CHECK`).

Concrete example — `createClinicUser`:
```ts
const actingProfile = await requireRole(["ADMIN"]);   // role from DB
const clinicId = requireClinicId(actingProfile);      // clinic from DB
// role validated against CLINIC_STAFF_ROLES so ADMIN/SUPER_ADMIN
// cannot be self-granted
```
The form has no clinic field at all, so an ADMIN cannot target another clinic.

---

## 5. Defects found in the documented schema

Three bugs in `docs/database.md` were found during implementation, approved for
fixing, and corrected in both the migration and the docs.

### 5.1 RLS infinite recursion — blocking

The documented `get_user_clinic_id()` selects from `profiles`, and the
`profiles` policy calls it. Postgres aborts with:

```
infinite recursion detected in policy for relation "profiles"
```

This blocks every profile read, including login — Phase 1 could not function.

**Fix:** `SECURITY DEFINER` so the function runs as its owner and bypasses RLS,
breaking the cycle. `SET search_path = public` pins the definer context against
search-path hijacking. Inlining `(SELECT role FROM profiles ...)` into a policy
causes identical recursion, so `current_user_role()` and `is_super_admin()`
follow the same shape.

### 5.2 Missing `WITH CHECK` — tenant isolation hole

Documented policies used `FOR ALL ... USING (...)` only. `USING` filters which
rows are *visible*; it does not constrain rows being *written*. A clinic user
could `INSERT` a row stamped with another clinic's `clinic_id` — accepted by the
database, then invisible to its author.

**Fix:** every policy permitting INSERT or UPDATE now carries `WITH CHECK`.

### 5.3 `clinic_config` secrets readable clinic-wide

`clinic_config` holds the live Resend API key and WhatsApp access token. The
documented policy allowed any user whose `clinic_id` matched to read it —
exposing those credentials to every FRONT_DESK, DOCTOR and PATIENT in the clinic.

**Fix:** reads scoped to that clinic's ADMIN plus SUPER_ADMIN. Application code
adds a second layer: `/settings` never sends stored secret values to the
browser, only a boolean per field indicating whether it is still a placeholder.
A blank input leaves the stored value untouched.

---

## 6. Other decisions and deviations

| Decision | Reason |
|---|---|
| `profiles.clinic_id` **NULLABLE**, CHECK-constrained | architecture.md: SUPER_ADMIN "is not automatically a member of every clinic". Consequence: `clinic_id = get_user_clinic_id()` is never true for SUPER_ADMIN because `NULL = NULL` yields NULL — policies must test `is_super_admin()` separately, and `id = auth.uid()` comes first so any user can load their own profile. |
| Dark mode via MUI `colorSchemes` | development-rules.md specified `useMediaQuery`, which decides mode in React and causes a light-mode flash plus hydration mismatch. Same requirement, framework built-in. |
| Server Actions, not `/api` route handlers | Approved. Roughly half the code, no fetch/serialisation boilerplate. |
| Temporary passwords shown once, not emailed | Resend is not wired until Phase 4. |
| Migration holds Phase 1 tables only | Building Phase 2–5 tables now would be building ahead of the roadmap. |
| Nav lists only Phase 1 routes | Linking to Patients/Appointments now would produce dead links. |
| `pool` settings retained but unused | supabase-js is HTTP/PostgREST and holds no TCP pool. Kept because documented; marked reserved in `.env.example`. |

**Pre-existing breakage repaired:** the `plan/` directory had been deleted, so
`CLAUDE.md` Quick Links and `docs/database.md` ("copy `plan/schema.sql`") both
pointed at files that no longer existed. Repointed to `supabase/migrations/`.

---

## 7. Verification status

### Static checks
```
npm run type-check   ✓  strict mode, zero `any`
npm run lint         ✓  clean
npm run build        ✓  9 routes + middleware
```

Grep audit: no hardcoded hex colours outside `src/themes/`, no `any` types, no
`clinic_id` sourced from client input.

### Schema applied and verified

Migration `0001_phase1_foundation.sql` applied to the live project.

| Check | Result |
|---|---|
| `clinics`, `clinic_config`, `profiles` exist | ✅ |
| RLS blocks unauthenticated reads on all three | ✅ 0 rows via anon key |
| `get_user_clinic_id`, `current_user_role`, `is_super_admin` resolve | ✅ confirms the `SECURITY DEFINER` fix applied |
| SUPER_ADMIN seeded with `clinic_id` NULL | ✅ |

### Tenant isolation — 10/10 passing

Executed with **real authenticated sessions** (two clinics, an ADMIN in each,
plus a DOCTOR in clinic A), not with the service-role key. Test clinics and
users were removed afterwards.

| # | Test | Result |
|---|---|---|
| 1 | Clinic A ADMIN sees only own clinic | ✅ 1 clinic |
| 2 | Cannot read clinic B directly by id | ✅ 0 rows |
| 3 | Cannot read clinic B profiles | ✅ 0 rows |
| 4 | Cannot read clinic B config | ✅ 0 rows |
| 5 | Can read own clinic config | ✅ |
| 6 | INSERT of a profile into clinic B | ✅ rejected, SQLSTATE `42501` |
| 7 | UPDATE of clinic B | ✅ 0 rows affected |
| 8 | Clinic B record unmodified afterwards | ✅ |
| 9 | DOCTOR in clinic A reading `clinic_config` | ✅ 0 rows — secrets protected |
| 10 | DOCTOR can still read own-clinic profiles | ✅ |

Test 6 is the direct proof that the `WITH CHECK` fix (§5.2) works: without it
that INSERT would have succeeded.
Test 9 is the direct proof of the `clinic_config` scoping fix (§5.3).

### Application smoke test

| Route | Result |
|---|---|
| `GET /login` | 200, renders email + password form |
| `GET /dashboard` (signed out) | 307 → `/login` |
| `GET /clinics` (signed out) | 307 → `/login` |

No dev-server errors.

### Still unverified

The **browser-driven** acceptance walkthrough in `docs/setup.md` — creating a
clinic through the UI, signing in as the provisioned ADMIN, creating staff,
saving real credentials, and confirming role-based nav renders per role. The
underlying server actions and policies are covered by the tests above, but the
end-to-end click-through has not been performed.

---

## 8. To pick this up

Environment, schema and SUPER_ADMIN are already in place. To run:

```bash
npm run dev            # http://localhost:3000
```

Sign in as the SUPER_ADMIN, then follow the acceptance walkthrough in
`docs/setup.md` — create a clinic, sign in as the provisioned ADMIN, add staff.

Phase 2 (Patients, Doctors & Appointments) can begin. Every later phase adds
clinic-owned tables, and each one must repeat the `clinic_id` + `USING` +
`WITH CHECK` policy pattern established here — the isolation tests should be
re-run at the end of each phase, not just this one.

---

## 9. References

- Development contract — [`CLAUDE.md`](../CLAUDE.md)
- Setup & verification — [`docs/setup.md`](../docs/setup.md)
- Architecture — [`docs/architecture.md`](../docs/architecture.md)
- Requirements — [`docs/requirements.md`](../docs/requirements.md)
- Database & RLS — [`docs/database.md`](../docs/database.md)
- Frontend rules — [`docs/development-rules.md`](../docs/development-rules.md)
