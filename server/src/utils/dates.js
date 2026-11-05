// Workout dates are stored as plain 'YYYY-MM-DD' strings. A workout belongs to the
// calendar day the user logged it on, so it must not shift when viewed from another
// timezone. Strings also sort chronologically, which keeps Mongo range queries simple.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const toUtc = (date) => new Date(`${date}T00:00:00.000Z`);
const fromUtc = (d) => d.toISOString().slice(0, 10);

export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = toUtc(value);
  return !Number.isNaN(d.getTime()) && fromUtc(d) === value;
}

export function addDays(date, days) {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS));
}

export function diffDays(later, earlier) {
  return Math.round((toUtc(later) - toUtc(earlier)) / DAY_MS);
}

/** Monday of the week containing `date`. */
export function weekStart(date) {
  const dow = (toUtc(date).getUTCDay() + 6) % 7; // Mon = 0 ... Sun = 6
  return addDays(date, -dow);
}

export function weekDates(week) {
  return Array.from({ length: 7 }, (_, i) => addDays(week, i));
}

/** Monday = 0 ... Sunday = 6 */
export function weekdayIndex(date) {
  return (toUtc(date).getUTCDay() + 6) % 7;
}

export function localToday(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
