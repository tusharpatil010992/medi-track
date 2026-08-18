/**
 * Clinic-facing reference numbers — P260818001, C260818001, INV260818001.
 *
 * A reference is its prefix, then a YYMMDD stamp, then a sequence that restarts
 * at 001 every day. Each clinic numbers independently, exactly as before: the
 * date is part of the value, so a daily restart still satisfies the
 * UNIQUE(clinic_id, ...) constraint on all three tables.
 *
 * The stamp is YYMMDD rather than DDMMYY so that sorting these columns as text
 * gives chronological order. The billing list relies on that, and it is why the
 * allocators below can scope a query to one day with a prefix match.
 *
 * The date is UTC, matching consultation_date and invoice_date, which are
 * already stamped from the server clock. The reference therefore always agrees
 * with the date stored on its own row.
 *
 * Superseded formats (P-0001, C-0001, INV-0001) are left exactly as issued —
 * they are printed on letters and bills already in patients' hands. They never
 * match a daily prefix, so they are invisible to allocation, and they sort
 * before every dated reference under both C and en_US collations, which is
 * chronologically right since they are all older.
 */

/** Width of the daily sequence. Beyond 999 a reference simply grows a digit. */
const SEQUENCE_DIGITS = 3;

/**
 * Today's allocation prefix for a series, e.g. "P260818".
 *
 * Callers use it twice: to select the day's existing references, and as the
 * head of the one they allocate.
 */
export function dailyPrefix(series: string, now: Date = new Date()): string {
  const iso = now.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  return `${series}${iso.slice(2, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}`;
}

/**
 * The next reference for a day, given every reference already issued under
 * that prefix.
 *
 * The highest is taken numerically, not as text: past 999 a clinic's sequence
 * widens to four digits, and "1000" sorts below "999" as a string.
 */
export function nextReference(prefix: string, existing: readonly string[]): string {
  let highest = 0;

  for (const reference of existing) {
    const sequence = Number(reference.slice(prefix.length));
    if (Number.isInteger(sequence) && sequence > highest) highest = sequence;
  }

  return `${prefix}${String(highest + 1).padStart(SEQUENCE_DIGITS, "0")}`;
}
