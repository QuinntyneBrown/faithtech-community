import { AgendaItem } from '@faithtech-community/api';
import { formatTime } from '@faithtech-community/components';

/** The event's start and end, as instants. */
export interface EventTimes {
  startsAt: string;
  endsAt: string;
}

const DAY = 24 * 60 * 60 * 1000;
const MAX_TITLE = 100;

/**
 * The instant of "18:30" on the event's date in the member's time zone (L2-159 AC6); a time before the start that falls
 * within the event on the next day, as for an event past midnight, is read on that day.
 */
export function agendaInstant(hours: number, minutes: number, event: EventTimes): Date {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const at = new Date(start);
  at.setHours(hours, minutes, 0, 0);
  const nextDay = new Date(at.getTime() + DAY);
  return at < start && nextDay <= end ? nextDay : at;
}

/** "18:30" from a time input as the instant it means for the event. */
export function timeInputInstant(value: string, event: EventTimes): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  return agendaInstant(Number(match[1]), Number(match[2]), event).toISOString();
}

/** "18:30" for a time input, in the member's time zone. */
export function timeInputValue(instant: string): string {
  const at = new Date(instant);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/** "Outside the event’s times (6:30 pm to 9:00 pm)" for a row before the start or after the end (L2-159 AC5). */
export function outsideWarning(startsAt: string, event: EventTimes): string | undefined {
  const at = new Date(startsAt).getTime();
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  return at < start || at > end
    ? `Outside the event’s times (${formatTime(event.startsAt)} to ${formatTime(event.endsAt)})`
    : undefined;
}

/** Puts a row among the others by time, after any at the same time. */
export function inTimeOrder<T extends { startsAt: string }>(rows: readonly T[], row: T): T[] {
  const at = new Date(row.startsAt).getTime();
  const index = rows.findIndex((r) => new Date(r.startsAt).getTime() > at);
  return index < 0 ? [...rows, row] : [...rows.slice(0, index), row, ...rows.slice(index)];
}

const LINE = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:[-–—:]\s*)?(\S.*?)\s*$/i;

/**
 * Reads a pasted schedule, one row per line such as "6:30 Doors open", "7:15 pm Lightning talks" or "19:45 – Demos"
 * (L2-159 AC3). A time without am or pm is read within the event's hours, or as close to its start as it can be; a line
 * without a time, or with a title past 100 characters, is listed as unreadable. Blank lines are skipped.
 */
export function parseSchedule(
  text: string,
  event: EventTimes,
): { rows: AgendaItem[]; unreadable: string[] } {
  const rows: AgendaItem[] = [];
  const unreadable: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = LINE.exec(line);
    const at = match ? readTime(match, event) : null;
    const title = match?.[4]?.replace(/\s+/g, ' ');
    if (!at || !title || title.length > MAX_TITLE) {
      unreadable.push(line);
      continue;
    }
    rows.push({ startsAt: at.toISOString(), title, detail: null });
  }
  return { rows, unreadable };
}

function readTime(match: RegExpExecArray, event: EventTimes): Date | null {
  const [, h, m, meridiem] = match;
  if (m === undefined && !meridiem) return null;
  const hours = Number(h);
  const minutes = Number(m ?? 0);
  if (hours > 23 || minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    const pm = meridiem.toLowerCase().startsWith('p');
    return agendaInstant((hours % 12) + (pm ? 12 : 0), minutes, event);
  }
  if (hours === 0 || hours > 12) return agendaInstant(hours, minutes, event);
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  const candidates = [hours % 12, (hours % 12) + 12].map((h24) =>
    agendaInstant(h24, minutes, event),
  );
  const within = candidates.find((c) => c.getTime() >= start && c.getTime() <= end);
  if (within) return within;
  return candidates.reduce((best, c) =>
    Math.abs(c.getTime() - start) < Math.abs(best.getTime() - start) ? c : best,
  );
}

/** "5 rows, 6:30 pm to 9:00 pm" for the review (L2-159 AC7). */
export function agendaSummary(rows: readonly AgendaItem[]): string {
  if (rows.length === 0) return 'No rows yet.';
  if (rows.length === 1) return `1 row, ${formatTime(rows[0].startsAt)}`;
  return `${rows.length} rows, ${formatTime(rows[0].startsAt)} to ${formatTime(rows[rows.length - 1].startsAt)}`;
}
