const DAY_MS = 86_400_000;
const utc = (date) => new Date(`${date}T00:00:00Z`);
const fmt = (options) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options });

export function localToday() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function addDays(date, days) {
  return new Date(utc(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function weekStart(date) {
  return addDays(date, -((utc(date).getUTCDay() + 6) % 7));
}

export const dayLetter = (date) => fmt({ weekday: 'narrow' }).format(utc(date));
export const dayShort = (date) => fmt({ weekday: 'short' }).format(utc(date));
export const monthShort = (date) => fmt({ month: 'short' }).format(utc(date));
export const dateShort = (date) => fmt({ day: 'numeric', month: 'short' }).format(utc(date));
export const dateLong = (date) => fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(utc(date));

export function weekRange(week) {
  return `${dateShort(week)} – ${dateShort(addDays(week, 6))}`;
}

export function relativeDay(date, today = localToday()) {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return dateLong(date);
}

export function minutes(total) {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
