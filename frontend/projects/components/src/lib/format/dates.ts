/*
 * Date formats from docs/mocks/README.md ("Tue 21 Oct"), built on the browser's Intl so no locale
 * data ships in the bundle.
 */
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** "Tue 20 Oct", without the comma some engines put after the weekday, and "Sep", not en-GB's "Sept". */
export function formatDay(value: Date | string): string {
  return DAY.format(new Date(value)).replace(',', '').replace('Sept', 'Sep');
}

/** "2026-10-21 10:05" in local time, for logs where entries sort by time. */
export function formatTimestamp(value: Date | string): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov": the short month of a date badge, in local time. Three letters on every engine. */
export function formatMonth(value: Date | string): string {
  return MONTHS[new Date(value).getMonth()];
}

/** "6:30 pm" in local time, the mocks' time format. */
export function formatTime(value: Date | string): string {
  const d = new Date(value);
  const hours = d.getHours() % 12 || 12;
  return `${hours}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'am' : 'pm'}`;
}

/** "Sat 14 – Sun 15 Nov" across days (the month once when shared), or "Fri 6 Nov" for one day. */
export function formatDayRange(start: Date | string, end: Date | string): string {
  const from = new Date(start);
  const to = new Date(end);
  if (from.toDateString() === to.toDateString()) return formatDay(from);
  const first = formatDay(from);
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return `${sameMonth ? first.slice(0, first.lastIndexOf(' ')) : first} – ${formatDay(to)}`;
}

/** "Today, 11:42 am" or "Yesterday, 4:10 pm" for recent activity, then the day, "Mon 19 Oct". */
export function formatFeedTime(value: Date | string, now: Date = new Date()): string {
  const at = new Date(value);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (at.toDateString() === now.toDateString()) return `Today, ${formatTime(at)}`;
  if (at.toDateString() === yesterday.toDateString()) return `Yesterday, ${formatTime(at)}`;
  return formatDay(at);
}

/** "Fri 6 Nov 2026 · 6:30 – 9:00 pm" (am or pm once when shared), or "Sat 14 – Sun 15 Nov 2026" across days. */
export function formatTimeRange(start: Date | string, end: Date | string): string {
  const from = new Date(start);
  const to = new Date(end);
  const year = from.getFullYear();
  if (from.toDateString() !== to.toDateString()) return `${formatDayRange(from, to)} ${year}`;
  const first = formatTime(from);
  const last = formatTime(to);
  const shared = first.slice(-2) === last.slice(-2);
  return `${formatDay(from)} ${year} · ${shared ? first.slice(0, -3) : first} – ${last}`;
}

/** "Today, 11:42 am" for a moment earlier today, otherwise "Mon 20 Oct": the notices' time format. */
export function formatWhen(value: Date | string, now: Date = new Date()): string {
  const d = new Date(value);
  return d.toDateString() === now.toDateString() ? `Today, ${formatTime(d)}` : formatDay(d);
}
