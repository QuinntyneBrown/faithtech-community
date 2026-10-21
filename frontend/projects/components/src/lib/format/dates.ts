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

const TIME = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

/** "Today, 11:42 am" for today, otherwise "Mon 20 Oct": the notification lists' format. */
export function formatNoticeTime(value: Date | string, now: Date = new Date()): string {
  const d = new Date(value);
  const today =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return today
    ? `Today, ${TIME.format(d).replace(/\s/g, ' ').replace(/^0:/, '12:')}`
    : formatDay(d);
}
