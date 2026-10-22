import { Route } from '@playwright/test';

import type { MockAccount, MockProfile } from './mock-api';
import type { MockAnnouncement } from './mock-announcements';
import type { MockEvent } from './mock-events';
import type { MockPartner } from './mock-partners';

/** What the reports fake reads from the rest of the fake backend. It never reads contacts (L2-100 AC6). */
export interface ReportsContext {
  readonly accounts: Map<string, MockAccount>;
  readonly profiles: Map<string, MockProfile>;
  readonly events: { readonly events: MockEvent[] };
  readonly partners: { readonly partners: MockPartner[] };
  readonly announcements: { readonly announcements: MockAnnouncement[] };
  readonly now: Date;
}

export type ReportPeriod = 'last-30-days' | 'last-90-days' | 'this-year' | 'all-time';

const PERIODS: ReportPeriod[] = ['last-30-days', 'last-90-days', 'this-year', 'all-time'];
const DAY = 24 * 60 * 60 * 1000;
const NO_CITY = 'No city';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MockReport {
  city: string | null;
  period: ReportPeriod;
  from: string | null;
  to: string;
  cities: string[];
  isEmpty: boolean;
  figures: {
    members: { value: number; newInPeriod: number | null };
    eventsHeld: { value: number; cancelled: number };
    rsvps: { value: number; checkedIn: number; checkedInPercent: number | null };
    partnersConfirmed: { value: number; inPipeline: number };
    announcements: { value: number };
  };
  membersByCity: { label: string; value: number }[];
  newMembersByMonth: { month: string; label: string; value: number; soFar: boolean }[];
  partnerPipeline: { city: string; lead: number; inFunnel: number; confirmed: number }[];
  events: {
    id: string;
    title: string;
    startsAt: string;
    city: string;
    status: 'Held' | 'Upcoming' | 'Cancelled';
    going: number | null;
    checkedIn: number | null;
    checkedInPercent: number | null;
  }[];
}

/** Ordinal-ignore-case, as the server sorts the city list. */
const byName = (a: string, b: string) => {
  const x = a.toUpperCase();
  const y = b.toUpperCase();
  return x < y ? -1 : x > y ? 1 : 0;
};

/** Rounded half away from zero, as GetReportHandler.Percent; null with nothing to divide by. */
const percent = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((100 * part) / whole);

const blank = (city: string | null | undefined) => !city || city.trim() === '';

/**
 * Plays the reports endpoints (backend/src/FaithTech.Community.Api/Endpoints/ReportsEndpoints.cs). It computes the
 * report from the fake's own accounts, profiles, events, partners and announcements with the definitions of ADR 0026,
 * so the page's numbers, privacy and exclusions are asserted end to end. Fail it with
 * `api.on('GET', '/api/reports', …)`.
 */
export class MockReports {
  constructor(private readonly context: ReportsContext) {}

  handle(
    route: Route,
    method: string,
    url: URL,
    caller: MockAccount | null,
  ): Promise<void> | false {
    if (method !== 'GET' || url.pathname !== '/api/reports') return false;
    if (!caller) return route.fulfill({ status: 401 });
    if (!caller.roles.some((r) => r === 'Staff' || r === 'SystemAdmin')) {
      return route.fulfill({ status: 403 });
    }
    const result = this.report(url.searchParams.get('city'), url.searchParams.get('period'));
    if ('field' in result) {
      return route.fulfill({
        status: 400,
        json: {
          title: 'One or more validation errors occurred.',
          status: 400,
          errors: { [result.field]: [result.message] },
        },
      });
    }
    return route.fulfill({ json: result });
  }

  /** The report for the filters, or the filter the server refuses. */
  report(
    cityParam: string | null,
    periodParam: string | null,
  ): MockReport | { field: string; message: string } {
    const period = (periodParam || 'last-30-days') as ReportPeriod;
    if (!PERIODS.includes(period)) {
      return {
        field: 'period',
        message: 'Choose Last 30 days, Last 90 days, This year or All time.',
      };
    }
    const now = this.context.now;
    const from = this.from(period, now);
    const inWindow = (at: string | null | undefined) => {
      if (!at) return false;
      const t = new Date(at).getTime();
      return (from === null || t >= from.getTime()) && t <= now.getTime();
    };

    const allMembers = this.members();
    const events = this.context.events.events;
    const cities = [
      ...new Set([
        ...allMembers.filter((p) => !blank(p.homeCity)).map((p) => p.homeCity!),
        ...events.filter((e) => !blank(e.city)).map((e) => e.city),
      ]),
    ].sort(byName);
    const city = cityParam || null;
    if (city !== null && !cities.includes(city)) {
      return { field: 'city', message: 'Choose a city from the list.' };
    }

    const members = city === null ? allMembers : allMembers.filter((p) => p.homeCity === city);
    const cityEvents = city === null ? events : events.filter((e) => e.city === city);
    const started = cityEvents.filter((e) => inWindow(e.startsAt));
    const held = started.filter((e) => !e.isCancelled);
    const rsvps = held.flatMap((e) => e.rsvps).filter((r) => !r.isWalkIn);
    const checkedIn = rsvps.filter((r) => r.checkedInAt).length;
    const pipeline = this.pipeline(city, cities);
    const sum = (pick: (r: (typeof pipeline)[number]) => number) =>
      pipeline.reduce((total, r) => total + pick(r), 0);
    const announcements = this.context.announcements.announcements.filter(
      (a) =>
        inWindow(a.sentAt) &&
        (city === null || this.context.profiles.get(a.senderId)?.homeCity === city),
    );
    const table = this.eventRows(cityEvents, from, now);

    return {
      city,
      period,
      from: from?.toISOString() ?? null,
      to: now.toISOString(),
      cities,
      isEmpty: members.length === 0 && table.length === 0,
      figures: {
        members: {
          value: members.length,
          newInPeriod: from === null ? null : members.filter((p) => inWindow(p.joinedAtUtc)).length,
        },
        eventsHeld: { value: held.length, cancelled: started.length - held.length },
        rsvps: {
          value: rsvps.length,
          checkedIn,
          checkedInPercent: percent(checkedIn, rsvps.length),
        },
        partnersConfirmed: {
          value: sum((r) => r.confirmed),
          inPipeline: sum((r) => r.lead + r.inFunnel + r.confirmed),
        },
        announcements: { value: announcements.length },
      },
      membersByCity: this.membersByCity(members, city),
      newMembersByMonth: this.months(members, from, now),
      partnerPipeline: pipeline,
      events: table,
    };
  }

  private from(period: ReportPeriod, now: Date): Date | null {
    switch (period) {
      case 'last-30-days':
        return new Date(now.getTime() - 30 * DAY);
      case 'last-90-days':
        return new Date(now.getTime() - 90 * DAY);
      case 'this-year':
        return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      default:
        return null;
    }
  }

  /** Profiles whose account has a verified email and is not suspended. */
  private members(): MockProfile[] {
    const accounts = [...this.context.accounts.values()];
    return [...this.context.profiles.values()].filter((p) =>
      accounts.some((a) => a.profileId === p.id && a.verified && !a.suspended),
    );
  }

  private membersByCity(members: MockProfile[], city: string | null) {
    if (city !== null) return [{ label: city, value: members.length }];
    const counts = new Map<string, number>();
    for (const p of members.filter((m) => !blank(m.homeCity))) {
      counts.set(p.homeCity!, (counts.get(p.homeCity!) ?? 0) + 1);
    }
    const top = [...counts]
      .sort(([a, x], [b, y]) => y - x || byName(a, b))
      .slice(0, 4)
      .map(([label, value]) => ({ label, value }));
    const other = members.length - top.reduce((total, r) => total + r.value, 0);
    return other > 0 ? [...top, { label: 'Other', value: other }] : top;
  }

  private months(members: MockProfile[], from: Date | null, now: Date) {
    const monthOf = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const current = monthOf(now);
    const joins = members.filter((p) => p.joinedAtUtc).map((p) => new Date(p.joinedAtUtc!));
    const earliest = joins.length ? new Date(Math.min(...joins.map((d) => d.getTime()))) : now;
    const limit = new Date(current);
    limit.setUTCMonth(limit.getUTCMonth() - 11);
    let first = monthOf(from ?? earliest);
    if (first < limit.getTime()) first = limit.getTime();
    const start = Math.max(first, from?.getTime() ?? first);
    const months: Date[] = [];
    for (const m = new Date(first); m.getTime() <= current; m.setUTCMonth(m.getUTCMonth() + 1)) {
      months.push(new Date(m));
    }
    const year = now.getUTCFullYear();
    const sameYear = months.every((m) => m.getUTCFullYear() === year);
    return months.map((m) => ({
      month: `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`,
      label: sameYear
        ? MONTHS[m.getUTCMonth()]
        : `${MONTHS[m.getUTCMonth()]} ${m.getUTCFullYear()}`,
      value: joins.filter(
        (d) =>
          d.getTime() >= start &&
          d.getTime() <= now.getTime() &&
          d.getUTCFullYear() === m.getUTCFullYear() &&
          d.getUTCMonth() === m.getUTCMonth(),
      ).length,
      soFar: m.getTime() === current,
    }));
  }

  /** Lead, In funnel and Confirmed per owner home city; "No city" last; the period does not apply. */
  private pipeline(city: string | null, cities: string[]) {
    const rows = new Map<
      string,
      { city: string; lead: number; inFunnel: number; confirmed: number }
    >();
    const row = (name: string) => {
      if (!rows.has(name)) rows.set(name, { city: name, lead: 0, inFunnel: 0, confirmed: 0 });
      return rows.get(name)!;
    };
    for (const p of this.context.partners.partners.filter((x) => !x.archivedAtUtc)) {
      const ownerCity = p.ownerId ? this.context.profiles.get(p.ownerId)?.homeCity : null;
      const r = row(blank(ownerCity) ? NO_CITY : ownerCity!);
      if (p.stage === 'Lead') r.lead++;
      else if (p.stage === 'InFunnel') r.inFunnel++;
      else r.confirmed++;
    }
    if (city !== null) return [row(city)];
    const named = [...new Set([...cities, ...[...rows.keys()].filter((k) => k !== NO_CITY)])]
      .sort(byName)
      .map(row);
    return rows.has(NO_CITY) ? [...named, rows.get(NO_CITY)!] : named;
  }

  /** Events from the start of the window to 30 days after now, newest first, at most 50. */
  private eventRows(events: MockEvent[], from: Date | null, now: Date): MockReport['events'] {
    const until = now.getTime() + 30 * DAY;
    return events
      .filter((e) => {
        const t = new Date(e.startsAt).getTime();
        return (from === null || t >= from.getTime()) && t <= until;
      })
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .slice(0, 50)
      .map((e) => {
        const going = e.rsvps.filter((r) => !r.isWalkIn).length;
        const checkedIn = e.rsvps.filter((r) => !r.isWalkIn && r.checkedInAt).length;
        const base = { id: e.id, title: e.title, startsAt: e.startsAt, city: e.city };
        if (e.isCancelled) {
          return {
            ...base,
            status: 'Cancelled',
            going: null,
            checkedIn: null,
            checkedInPercent: null,
          };
        }
        if (new Date(e.startsAt).getTime() > now.getTime()) {
          return { ...base, status: 'Upcoming', going, checkedIn: null, checkedInPercent: null };
        }
        return {
          ...base,
          status: 'Held',
          going,
          checkedIn,
          checkedInPercent: percent(checkedIn, going),
        };
      });
  }
}
