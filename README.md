# Medi-Track

Multi-tenant clinic management. One Next.js application serving many clinics,
with per-clinic data isolation enforced in the database.

**Status:** Phases 1–2 of 5 complete — foundation, multi-tenancy, clinic users, patients and appointments.

---

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · MUI 6 · Supabase
(Postgres + Auth + RLS) · Vercel

No separate backend, no microservices, no Docker requirement.

## Architecture in one paragraph

The clinic is the tenant and the security boundary. Every clinic-owned row
carries a `clinic_id`, and that value is **always** derived server-side from the
authenticated user's profile — never from a request body, query string or form
field. Isolation is enforced twice: once in application code (Server Actions
that resolve role and clinic before touching data) and once in Postgres
Row-Level Security, so a bug in the former does not breach the latter.

## Roles

`SUPER_ADMIN` (platform, belongs to no clinic) · `ADMIN` · `DOCTOR` ·
`OPTOMETRIST` · `STAFF` · `FRONT_DESK` · `PATIENT`

All roles share a single login page. The role is resolved from the profile
after authentication; it is never selected by the user.

## Getting started

```bash
npm install
cp .env.example .env.local     # add your Supabase keys
npm run dev
```

Full setup — applying migrations, seeding the first SUPER_ADMIN, and running the
tenant-isolation tests — is in **[docs/setup.md](docs/setup.md)**.

## Documentation

| Doc | Contents |
|---|---|
| [docs/setup.md](docs/setup.md) | Setup, seeding, isolation verification |
| [docs/architecture.md](docs/architecture.md) | System design, roles, multi-tenancy |
| [docs/requirements.md](docs/requirements.md) | Features across all five phases |
| [docs/database.md](docs/database.md) | Schema and RLS policy patterns |
| [docs/development-rules.md](docs/development-rules.md) | Frontend and coding standards |
| [CLAUDE.md](CLAUDE.md) | Development contract |
| [summary/phase1_implementation.md](summary/phase1_implementation.md) | Phase 1 report and verification results |
| [summary/phase2_implementation.md](summary/phase2_implementation.md) | Phase 2 report and verification results |

## Delivery phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation, multi-tenancy, clinic users | ✅ Complete |
| 2 | Patients, doctors, appointments | ✅ Complete |
| 3 | Consultations, medicines, printing | Not started |
| 4 | Billing, notifications | Not started |
| 5 | Documents, audit, production readiness | Not started |

## Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm run type-check   # TypeScript, strict
npm run lint         # ESLint

npm run verify:isolation   # multi-tenant isolation suite (needs .env.local)
```

## Security notes

- `.env.local` holds the Supabase **service-role key**, which bypasses RLS
  entirely. It is gitignored and must stay server-side.
- Database changes go in `supabase/migrations/` as new files. Applied
  migrations are never edited.
- Records are deactivated via `is_active`, never hard-deleted — historical
  medical and billing data must survive.
