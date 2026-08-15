# Setup & Verification

How to bring Phase 1 up locally and prove that tenant isolation actually holds.

---

## 1. Install

```bash
npm install
```

## 2. Supabase project

Create a project at [supabase.com](https://supabase.com), then copy
Project Settings → API values into `.env.local`:

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. `.env.local` is gitignored and must stay that way —
the service-role key bypasses RLS entirely.

## 3. Apply the migration

Supabase Dashboard → SQL Editor → paste `supabase/migrations/0001_phase1_foundation.sql` → Run.

Confirm it landed:

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
```

Expect `clinics`, `clinic_config`, `profiles`, each with `rowsecurity = true`.

## 4. Seed the first SUPER_ADMIN

This account cannot be created through the UI — it creates everything else.

1. Authentication → Users → **Add user**. Set an email and password, enable **Auto Confirm User**.
2. Copy the new user's UUID.
3. SQL Editor:

```sql
INSERT INTO profiles (id, clinic_id, email, full_name, role)
VALUES ('<uuid>', NULL, '<email>', 'Platform Admin', 'SUPER_ADMIN');
```

`clinic_id` must be NULL — the CHECK constraint rejects a SUPER_ADMIN with a clinic.

## 5. Run

```bash
npm run dev
```

Open http://localhost:3000 → redirects to `/login`.

---

## Phase 1 acceptance walkthrough

The Phase 1 demo flow from `docs/requirements.md`:

1. Sign in as SUPER_ADMIN → lands on `/dashboard`, sidebar shows **Dashboard** and **Clinics** only.
2. Clinics → **New clinic** → fill clinic name + administrator name/email → Create.
3. Temporary ADMIN credentials are shown **once**. Copy them.
4. Verify the clinic row appears with status **Active**.
5. Sign out. Sign in as the new ADMIN at the same `/login`.
6. Sidebar now shows **Dashboard**, **Users**, **Clinic Settings** — no Clinics link.
7. Clinic Settings → placeholders flagged with a warning → enter a real Resend key → Save → warning clears for that field.
8. Users → **New user** → create a Doctor and a Front Desk user. Credentials shown once each.
9. Sign in as the Doctor → sidebar shows Dashboard only.
10. Deactivate the Doctor from the ADMIN's Users page, then attempt to sign in as that Doctor → rejected with "This account is inactive".

---

## Multi-tenant isolation tests

**These are the tests that matter.** Run them after creating **two** clinics, A and B.
Every one must fail to return data. Passing type-checks proves nothing here —
isolation lives in RLS and in the server actions.

### Via the UI

| Attempt | Expected |
|---|---|
| ADMIN of A opens `/clinics` | Redirected to `/dashboard` — SUPER_ADMIN only |
| ADMIN of A opens `/settings` | Sees only clinic A's config |
| Doctor of A opens `/users` | Redirected to `/dashboard` — ADMIN only |
| Signed-out user opens `/dashboard` | Redirected to `/login` |
| ADMIN of A creates a user | New user's `clinic_id` is A, with no way to choose B |

### Via SQL, as a real user

Application-layer checks can be bypassed; RLS cannot. Test the database directly.
In the SQL Editor, impersonate a clinic-A user:

```sql
-- Impersonate an authenticated request from a clinic A user
SET request.jwt.claims = '{"sub":"<clinic-A-user-uuid>","role":"authenticated"}';
SET ROLE authenticated;

-- Each of these MUST return zero rows
SELECT * FROM patients      WHERE clinic_id = '<clinic-B-id>';   -- Phase 2+
SELECT * FROM profiles      WHERE clinic_id = '<clinic-B-id>';
SELECT * FROM clinic_config WHERE clinic_id = '<clinic-B-id>';
SELECT * FROM clinics       WHERE id        = '<clinic-B-id>';

-- This MUST be rejected by the WITH CHECK clause
INSERT INTO profiles (id, clinic_id, email, full_name, role)
VALUES (gen_random_uuid(), '<clinic-B-id>', 'x@x.com', 'X', 'DOCTOR');

RESET ROLE;
```

### Secret exposure check

As a **non-ADMIN** clinic A user (e.g. the Doctor), this must return zero rows —
`clinic_config` holds the Resend key and WhatsApp token:

```sql
SELECT * FROM clinic_config;
```

---

## Checks that run without a database

```bash
npm run type-check   # TypeScript strict, no `any`
npm run lint         # ESLint
npm run build        # production build
```

These verify the code compiles and the routes build. They do **not** verify
authentication, authorisation or tenant isolation — only the tests above do.
