# CLAUDE.md - Project Guidelines for Medi-Track

AI Assistant guidelines and project development instructions for Medi-Track.

---

## Project Overview

**Medi-Track** - A secure, multi-tenant clinic management system.

**Stack:** Next.js + TypeScript + MUI + Supabase + Vercel

**Principle:** Keep it simple. Do not over-engineer.

---

## Documentation Paths

### Primary Documentation (Start Here)

- **[docs/README.md](./docs/README.md)** - Navigation hub and quick reference
- **[docs/architecture.md](./docs/architecture.md)** - System design and multi-tenancy
- **[docs/requirements.md](./docs/requirements.md)** - Features and 5-phase breakdown
- **[docs/database.md](./docs/database.md)** - Database schema and RLS policies
- **[docs/development-rules.md](./docs/development-rules.md)** - Frontend and coding rules

---

### Before You Code

1. **Read the relevant documentation section**

   ```
   If working on: → Read from docs/
   - Authentication         → architecture.md (User Roles section)
   - Database changes       → database.md
   - Frontend component     → development-rules.md
   - Feature requirements   → requirements.md (Phase X section)
   - System design          → architecture.md
   ```

2. **Understand the context**
   - What phase is this feature in?
   - What tables does it involve?
   - What security rules apply?
   - Who can access this data?

3. **Check if it exists**
   - Search existing code before creating new files
   - Reuse components when possible
   - Don't duplicate functionality

4. **Verify architecture compliance**
   - Does this change violate multi-tenancy?
   - Is clinic_id enforced server-side?
   - Are RLS policies in place?
   - Is this Vercel-compatible?

### During Implementation

- Write the smallest appropriate change
- Follow existing code patterns
- Use theme tokens (never hardcoded colors)
- Add TypeScript types
- Keep it readable and simple

### After Implementation

- Run type checker: `npm run type-check`
- Run linter: `npm run lint`
- Test in browser (light and dark mode)
- Verify responsive on mobile
- Check accessibility (keyboard nav, screen reader)

---

## Mandatory Development Workflow

**For every development task, follow these 7 steps:**

### 1. Read Documentation

```
What documentation is relevant to this task?
→ Read it completely before starting
```

**Example Tasks:**

- Adding a new table? → Read docs/database.md
- Creating a component? → Read docs/development-rules.md
- Adding role-based feature? → Read docs/architecture.md
- Implementing new endpoint? → Read docs/requirements.md + architecture.md

### 2. Check Existing Implementation

```
Has something similar already been built?
→ Search the codebase
→ Don't duplicate
→ Reuse when appropriate
```

**Before creating:**

- New component → Search `src/components/`
- New hook → Search `src/lib/` and `src/features/*/hooks/`
- New type → Search `src/types/`
- New utility → Search `src/lib/`

### 3. Verify Architecture Compliance

```
Does this change violate the documented architecture?
→ Check docs/architecture.md (Security Principles section)
```

**Critical Checks:**

- [ ] `clinic_id` never from client (always server-side)
- [ ] Authorization checked server-side (not just UI)
- [ ] RLS policies in place (database-level security)
- [ ] Vercel-compatible (no persistent workers)
- [ ] No secrets exposed
- [ ] No hardcoded colors/values (use theme)
- [ ] TypeScript strict mode
- [ ] Soft deletes only (no hard-delete on historical data)

### 4. Implement the Smallest Change

```
What is the minimum code needed to solve this?
→ Write just that
→ No premature abstractions
→ No over-engineering
```

**Anti-patterns to avoid:**

- ❌ Creating a helper utility for something used once
- ❌ Building a complex state management for simple state
- ❌ Extracting a component before it's reused
- ❌ Adding features not in the requirements
- ❌ Refactoring working code unnecessarily

**Good patterns:**

- ✅ Keep functions focused (single responsibility)
- ✅ Write readable code with clear names
- ✅ Use framework built-ins (Next.js, MUI)
- ✅ Copy-paste is okay for now (don't create premature abstractions)
- ✅ Comment only non-obvious logic

### 5. Run Type Checks & Linting

```
$ npm run type-check    # TypeScript strict mode
$ npm run lint          # ESLint
$ npm run test          # If tests exist
```

**Must pass:**

- No TypeScript errors
- No `any` types
- No console errors/warnings
- No unused imports

### 6. Review Against Documentation

```
Does my implementation match the documented approach?
→ Check docs/development-rules.md for component patterns
→ Check docs/architecture.md for data flow
→ Check docs/requirements.md for feature completeness
```

**Checklist:**

- [ ] Following MUI patterns (no custom buttons)
- [ ] Using theme tokens (no hardcoded colors)
- [ ] Responsive design (mobile-first)
- [ ] Dark mode works
- [ ] Accessibility considered
- [ ] No unnecessary complexity
- [ ] Matches documented behavior

### 7. Report Deviations

```
If the implementation cannot follow the documentation:
→ Report the deviation
→ Explain why
→ Propose an alternative
→ Do NOT implement without explicit approval
```

**Example deviation report:**

```
Task: Add custom date picker component
Status: BLOCKED - Deviation from architecture

Issue: MUI doesn't have a custom date picker matching the design
Documented approach: Use MUI built-in components only
Proposed alternatives:
1. Use MUI DatePicker (existing, approved)
2. Request design change to match MUI DatePicker
3. Get explicit approval to add external library

Awaiting decision before proceeding.
```

---

## Core Principles

### Keep It Simple

**Every line of code should be justified.**

❌ Don't:

```typescript
// Over-engineered factory pattern
const createUserRepository = (db: Database) => ({
  findById: async (id: string) => db.query("users", { id }),
  findAll: async () => db.query("users"),
  create: async (user: User) => db.insert("users", user),
  update: async (id: string, user: User) => db.update("users", { id }, user),
  delete: async (id: string) => db.delete("users", { id }),
});
```

✅ Do:

```typescript
// Simple, direct query
const getUser = async (id: string) => {
  return supabase
    .from("profiles")
    .select()
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();
};
```

### Readable Code

**A junior developer should understand your code without asking.**

❌ Don't:

```typescript
const u = (d) =>
  d.map((x) => ({
    ...x,
    s: x.s === "A" ? "ACTIVE" : x.s === "C" ? "CANCELLED" : "PENDING",
  }));
```

✅ Do:

```typescript
const formatAppointmentStatus = (appointments) => {
  return appointments.map((apt) => ({
    ...apt,
    status: getStatusLabel(apt.status),
  }));
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case "A":
      return "ACTIVE";
    case "C":
      return "CANCELLED";
    default:
      return "PENDING";
  }
};
```

### Manageable

**Keep functions/components focused. Keep files small.**

❌ Don't:

```typescript
// 500-line component doing everything
export const PatientPage = () => {
  // Auth logic
  // Data fetching
  // Form validation
  // Table rendering
  // Filtering
  // Sorting
  // Pagination
  // PDF export
  // Email integration
  // ...all in one file
};
```

✅ Do:

```typescript
// Split into focused parts
// Page: Composition + layout
export const PatientPage = () => (
  <Box>
    <PatientHeader />
    <PatientTable />
  </Box>
);

// Component: Table only
const PatientTable = () => (
  <DataTable columns={columns} data={patients} />
);

// Hook: Data fetching
const usePatients = (clinicId) => {
  return useQuery(['patients', clinicId], () => fetchPatients(clinicId));
};
```

---

## Important Rules

### Security (Non-Negotiable)

🔒 **Rule 1: Never trust clinic_id from client**

```typescript
// ❌ WRONG - clinic_id from request body
const createPatient = async (req) => {
  const { clinic_id, name } = req.body; // WRONG!
  await db.insert("patients", { clinic_id, name });
};

// ✅ RIGHT - clinic_id from authenticated user
const createPatient = async (req) => {
  const clinicId = userProfile.clinic_id; // From auth
  const { name } = req.body;
  await db.insert("patients", { clinic_id: clinicId, name });
};
```

🔒 **Rule 2: Always check authorization server-side**

```typescript
// ❌ WRONG - only checking UI
if (userRole === 'ADMIN') {
  return <AdminPanel />;  // Client can fake this!
}

// ✅ RIGHT - server checks too
const getAdminPanel = async (req) => {
  const userRole = await getUserRole(req.user.id);
  if (userRole !== 'ADMIN') {
    throw new ForbiddenError('Not authorized');
  }
  // ... return admin data
};
```

🔒 **Rule 3: Use RLS on all queries**
Supabase RLS is your second line of defense. It prevents accidental access bypasses in application logic.

```typescript
// ✅ Always query through Supabase (RLS enforced)
const getPatients = async (clinicId) => {
  return supabase.from("patients").select().eq("clinic_id", clinicId); // RLS policy will verify this
};
```

### Architecture (Non-Negotiable)

📐 **Rule 4: No hardcoded colors or values**

```typescript
// ❌ WRONG
<Box sx={{ color: '#1976d2', fontSize: '14px', padding: '16px' }} />

// ✅ RIGHT
<Box sx={{ color: 'primary.main', fontSize: '14px', p: 2 }} />
// Or better:
<Box sx={{ color: 'primary.main', typography: 'body2', p: 2 }} />
```

📐 **Rule 5: No database triggers**
Application code handles `updated_at` and audit logging explicitly.

```typescript
// ❌ DON'T rely on database trigger
UPDATE patients SET name = 'New Name' WHERE id = '123';

// ✅ DO include updated_at
UPDATE patients
SET name = 'New Name', updated_at = NOW(), updated_by = '456'
WHERE id = '123' AND clinic_id = '789';
```

📐 **Rule 6: Soft deletes only**
Never hard-delete records referenced by history.

```typescript
// ❌ WRONG - breaks history
DELETE FROM medicines WHERE id = 'med_123';

// ✅ RIGHT - preserve history
UPDATE medicines SET is_active = FALSE WHERE id = 'med_123';
```

### Code Quality

💻 **Rule 7: TypeScript strict mode**

- No `any` types
- Explicit return types
- All variables typed

```typescript
// ❌ WRONG
const getPatient = (id) => {
  return db.query("patients", { id });
};

// ✅ RIGHT
const getPatient = async (id: string): Promise<Patient> => {
  return supabase.from("patients").select().eq("id", id).single();
};
```

💻 **Rule 8: No unnecessary libraries**

```typescript
// ❌ WRONG - add date-fns for one line
import { format } from "date-fns";
const formatted = format(date, "MM/dd/yyyy");

// ✅ RIGHT - use built-in
const formatted = new Date(date).toLocaleDateString();
```

💻 **Rule 9: Prefer framework built-ins**

```typescript
// ❌ WRONG - add Redux for simple state
const [user, setUser] = useReduxState();

// ✅ RIGHT - use React built-in
const [user, setUser] = useState();
```

### Dependencies

📦 **Rule 10: No new libraries without approval**

Before adding a new library:

1. Check if MUI has it (prefer MUI)
2. Check if Next.js has it (prefer Next.js)
3. Check if it's already in package.json
4. If truly necessary, request approval in a comment

```typescript
// ❌ WRONG - just installed lodash
import { debounce } from "lodash";

// ✅ RIGHT - or request approval
// REQUEST: Can we add lodash-es for debounce?
// Rationale: Used in 3 different components
// Alternative: Implement debounce ourselves (20 lines)
```

### Database Changes

🗄️ **Rule 11: No schema changes without checking docs**

Before modifying the database:

1. Read [docs/database.md](./docs/database.md)
2. Check the complete schema in [plan/schema.sql](./plan/schema.sql)
3. Verify RLS policies are in place
4. Ensure clinic_id is on all clinic-owned tables
5. Use soft deletes (is_active) not hard deletes

```typescript
// ❌ WRONG - modifying schema without docs
ALTER TABLE patients ADD COLUMN favorite_color VARCHAR;

// ✅ RIGHT - documented and justified
// TODO: Add favorite_color to patients table for future personalization
// (Approved by product, Phase 6)
// - Check docs/database.md ✓
// - RLS policy: inherited from clinic_id ✓
// - Migration: docs/database.md pattern ✓
```

---

## Development Checklist

**Before submitting code:**

- [ ] Read relevant documentation section
- [ ] No duplicated functionality
- [ ] Follows existing code patterns
- [ ] TypeScript strict mode (no `any` types)
- [ ] No console errors or warnings
- [ ] No hardcoded colors/values (use theme)
- [ ] clinic_id from server (never from client)
- [ ] Authorization checked server-side
- [ ] RLS policies verified
- [ ] Dark mode tested
- [ ] Responsive on mobile
- [ ] Accessible (keyboard navigation, labels)
- [ ] No new libraries (or approved)
- [ ] No database schema changes (or documented)
- [ ] Soft deletes used (no hard deletes)
- [ ] Code is readable (would junior dev understand?)
- [ ] No over-engineering
- [ ] Vercel-compatible

---

## Common Decisions

### Should I create a custom component?

**Rule:** Only if it's reused in 2+ places, OR if MUI doesn't have it.

❌ Don't create custom `<PatientCard>` if used in only one place
✅ Create if used in `/dashboard` and `/search` and `/reports`
✅ Create custom optical power form (MUI doesn't have it)

### Should I extract a hook?

**Rule:** Only if the logic is reused OR if the component is >100 lines.

❌ Don't: `const useGetId = () => useParams().id`
✅ Do: `const usePatients = (clinicId)` (used in 3 components)

### Should I add error handling?

**Rule:** Only for external boundaries (API, user input). Trust internal logic.

❌ Don't: `if (name === undefined) throw Error()`
✅ Do: Handle API errors, invalid user input, network failures

### Should I add a comment?

**Rule:** Only for non-obvious logic. Code should be self-documenting.

❌ Don't:

```typescript
// Increment count
count++;
```

✅ Do:

```typescript
// Deduct from clinic balance if invoice marked as void
// (per accounting policy, this only affects current month)
clinicBalance -= invoice.amount;
```

---

## When to Ask for Help

**Stop and ask before:**

1. **Deviating from architecture**
   - "This requires a background worker process"
   - "We need to use Express instead of Next.js"
   - "Should I bypass RLS for this query?"

2. **Adding new libraries**
   - "I need to add chart-js"
   - "Should we use Redux?"
   - "Can I use Lodash?"

3. **Schema changes**
   - "I need to delete old patient records"
   - "Should I add this new column?"
   - "Can I rename this table?"

4. **Major refactors**
   - "Should I restructure the file layout?"
   - "Can I rewrite this component?"
   - "Should I extract this logic?"

5. **Scope expansion**
   - "Should I add PDF export?"
   - "Can I add dark mode theme selector?"
   - "Should I implement this nice-to-have feature?"

---

## File You'll Edit Most

- **Pages:** `src/app/` (Next.js App Router)
- **Components:** `src/components/`
- **Features:** `src/features/`
- **Types:** `src/types/`
- **Config:** `src/config/` and `src/lib/`

**Files you should NOT edit without reviewing docs:**

- `supabase/migrations/*.sql` - Applied migrations are immutable; add a new file instead
- `.env.example` - Environment template
- `next.config.ts` - Next.js config
- `tsconfig.json` - TypeScript config

---

## Workflow Summary

```
1. READ docs/ (5 min)
   ↓
2. SEARCH codebase (2 min)
   ↓
3. VERIFY architecture (5 min)
   ↓
4. WRITE code - SIMPLE (30 min)
   ↓
5. RUN type-check, lint (2 min)
   ↓
6. REVIEW against docs (5 min)
   ↓
7. REPORT deviations (if any)
   ↓
DONE ✓
```

---

## Quick Links

- 📖 **Documentation:** [docs/](./docs/)
- 🗄️ **Migrations:** [supabase/migrations/](./supabase/migrations/) — one file per phase, applied in order
- 🚀 **Setup & verification:** [docs/setup.md](./docs/setup.md)

## Delivery Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation, multi-tenancy, clinic users | ✅ Complete — schema applied, tenant isolation verified 10/10 ([summary](./summary/phase1_implementation.md)) |
| 2 | Patients, doctors, appointments | ✅ Complete — 24/24 isolation tests ([summary](./summary/phase2_implementation.md)) |
| 3 | Consultations, medicines, printing | Not started |
| 4 | Billing, notifications | Not started |
| 5 | Documents, audit, production readiness | Not started |

---

## The One True Rule

**Keep it simple. Keep it readable. Keep it manageable.**

When in doubt, choose the simplest solution that solves the problem.

Don't build for "what if". Build for "what is".

---

**Last Updated:** 2026-08-15  
**Project:** Medi-Track  
**For:** AI Assistants & Developers
