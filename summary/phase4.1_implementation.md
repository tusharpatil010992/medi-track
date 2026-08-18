# Phase 4.1 — Date-stamped reference numbers

> Patient, consultation and invoice references gained a date. `P-0001` became
> `P260818001`: prefix, `YYMMDD`, then a sequence that restarts at 001 each day.

**Scope:** the format of three existing columns, and nothing else. No schema
change, no migration, no new dependency, no UI change, no Phase 5 work.

---

## What changed

| Series | Before | After |
|---|---|---|
| Patient | `P-0001` | `P260818001` |
| Consultation | `C-0001` | `C260818001` |
| Invoice | `INV-0001` | `INV260818001` |

Uniqueness is still per clinic. The daily restart is safe because the date is
part of the value, so `UNIQUE(clinic_id, ...)` continues to hold on all three
tables with no change to the constraint.

## Why `YYMMDD` and not `DDMMYY`

`DDMMYY` was the first proposal, and it was wrong: `P010926001` sorts before
`P180826001`, so text order stops matching time order. That would have broken
the billing list's `invoice_date` then `invoice_number` sort and forced every
ordering guarantee to be re-derived from a date column.

`YYMMDD` keeps text order and chronological order the same thing. Two
consequences follow directly:

- An allocator can scope its read to one day with a prefix match.
- Superseded references sort **before** every dated one — correct, since they
  are all older. The hyphen in `P-0001` precedes digits under `C` collation, and
  is ignored at the primary level under the `en_US` default Supabase uses, so
  `P0001` vs `P260818001` compares `0 < 2`. Both collations agree.

## How allocation works now

Each of the three server actions builds today's prefix, reads that day's
references for the clinic, and takes the **numeric** maximum:

```typescript
const prefix = dailyPrefix("P");            // "P260818"

const { data } = await supabase
  .from("patients")
  .select("patient_number")
  .eq("clinic_id", clinicId)
  .like("patient_number", `${prefix}%`)
  .returns<{ patient_number: string }[]>();

return nextReference(prefix, (data ?? []).map((row) => row.patient_number));
```

Numeric, not lexicographic, because past 999 the sequence widens to four digits
and `"1000"` sorts below `"999"` as text. The old code took the lexicographic
maximum and would have stalled at 999 forever.

The `23505` retry loops are untouched. They remain the actual protection against
two front-desk registrations racing for the same number; nothing about that
changed.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Invoice prefix | Keep `INV` | The bill and the notification body both say "invoice"; 12 characters is nothing in `VARCHAR(50)` |
| Which clock | UTC | Matches `consultation_date` / `invoice_date`, already stamped from the server clock, so the reference agrees with its own row. Costs no extra query |
| Existing rows | Left as issued | They are printed on letters and bills already handed to patients, and an invoice number is a financial record |
| Past 999 | Widen to 4 digits | Failing an insert at 999 is worse than an inconsistent width |

The UTC choice has a known edge, recorded in `docs/database.md`: a clinic **west**
of UTC would see an evening visit carry the next day's stamp. For IST the two
diverge only between 00:00 and 05:30 local, when no clinic is open. Fixing it
means reading `clinics.timezone` and using it for the two date columns too, so
they do not drift apart — not done here, because no such clinic exists yet.

## Files

```
src/lib/reference-numbers.ts          new — dailyPrefix(), nextReference()
src/features/patients/actions.ts      nextPatientNumber()
src/features/consultations/actions.ts nextConsultationNumber()
src/features/billing/actions.ts       nextInvoiceNumber()
src/components/billing/InvoiceSearch.tsx  search placeholder
src/types/patient.ts                  patient_number doc comment
src/types/clinical.ts                 consultation_number doc comment
docs/database.md                      new "Reference numbering" section; three column notes
docs/requirements.md                  three example references
docs/setup.md                         billing verification steps
```

No call-site logic needed updating. The types stay `string`; the print pages,
search filters and list orderings all read the columns unchanged. The only
user-visible edit outside the numbers themselves is the billing search
placeholder, which used to advertise the superseded format.

## Verification

| Check | Result |
|---|---|
| `npm run type-check` | Clean |
| `npm run lint` | Clean |
| `npm run verify:isolation` | 119/119, unchanged |
| Format and sequence logic | 12/12 (see below) |

`verify-isolation.mjs` was **not** changed. Its `P-9001` / `C-9500` / `INV-9001`
literals insert directly through Supabase clients to test RLS and uniqueness
constraints; they never reach the allocator, and the constraints under test are
format-agnostic.

That leaves the allocation logic itself with no automated coverage — the project
has no test runner (`npm run test` is not a script). The 12 checks above were run
from a scratchpad script against `dailyPrefix()` and `nextReference()`, covering:
first and second of a day, out-of-order input, superseded values ignored, the
999 → 1000 widening, numeric-beats-text maximum, and text sorting matching
chronological order. Adding a test runner is a Phase 5 concern, not this one.

**Still to do manually:** register two patients on one day and confirm `001` then
`002`; open a consultation; raise, issue and part-pay an invoice; confirm the
reference renders on the consultation letter, the printed invoice and the payment
receipt; confirm billing search finds an invoice by its number and a visit by its
consultation reference. Light and dark mode, mobile width.
