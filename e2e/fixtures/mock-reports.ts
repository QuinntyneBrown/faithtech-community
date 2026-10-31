import { Route } from '@playwright/test';

import type { MockAccount, MockProfile } from './mock-api';
import type { MockAnnouncement } from './mock-announcements';
import type { MockEvent } from './mock-events';
import type { MockPartner } from './mock-partners';
import { holds } from './role-definitions';

/** What the reports fake reads from the rest of the fake backend. It never reads contacts (L2-125 AC6). */
export interface ReportsContext {
  readonly accounts: Map<string, MockAccount>;
  readonly profiles: Map<string, MockProfile>;
  readonly events: { readonly events: MockEvent[] };
  readonly partners: { readonly partners: MockPartner[] };
  readonly announcements: { readonly announcements: MockAnnouncement[] };
  readonly now: Date;
  readonly chapters: {
    nameOf(id: string | null | undefined): string | null;
    options(): { id: string; name: string }[];
  };
  readonly host: {
    organisation: {
      name: string;
      shortName: string;
      chapterLabel: { singular: string; plural: string } | null;
    };
  };
}

export type ReportPeriod = 'last-30-days' | 'last-90-days' | 'this-year' | 'all-time';

const PERIODS: ReportPeriod[] = ['last-30-days', 'last-90-days', 'this-year', 'all-time'];
const DAY = 24 * 60 * 60 * 1000;
/** The single pipeline row while chapters are off. */
const WHOLE_PIPELINE = 'Partner pipeline';
const PERIOD_LABELS: Record<ReportPeriod, string> = {
  'last-30-days': 'Last 30 days',
  'last-90-days': 'Last 90 days',
  'this-year': 'This year',
  'all-time': 'All time',
};

/** EventFileNames.Slug: lower-case letters and digits joined by hyphens. */
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '') || 'event';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MockReport {
  chapter: string | null;
  chapterName: string | null;
  period: ReportPeriod;
  from: string | null;
  to: string;
  chapters: { id: string; name: string }[];
  isEmpty: boolean;
  figures: {
    members: { value: number; newInPeriod: number | null };
    eventsHeld: { value: number; cancelled: number };
    rsvps: { value: number; checkedIn: number; checkedInPercent: number | null };
    partnersConfirmed: { value: number; inPipeline: number };
    announcements: { value: number };
  };
  membersByChapter: { label: string; value: number }[];
  newMembersByMonth: { month: string; label: string; value: number; soFar: boolean }[];
  partnerPipeline: { chapter: string; lead: number; inFunnel: number; confirmed: number }[];
  events: {
    id: string;
    title: string;
    startsAt: string;
    chapter: string | null;
    status: 'Held' | 'Upcoming' | 'Cancelled';
    going: number | null;
    checkedIn: number | null;
    checkedInPercent: number | null;
  }[];
}

/** Ordinal-ignore-case, as the server sorts names. */
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
 * report from the fake's own accounts, profiles, events, partners and announcements with the definitions of ADR 0030,
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
    const exporting = url.pathname === '/api/reports/export.csv';
    if (method !== 'GET' || (url.pathname !== '/api/reports' && !exporting)) return false;
    if (!caller) return route.fulfill({ status: 401 });
    if (!holds(caller, 'ViewReports')) {
      return route.fulfill({ status: 403 });
    }
    const result = this.report(url.searchParams.get('chapter'), url.searchParams.get('period'));
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
    if (!exporting) return route.fulfill({ json: result });
    const date = this.context.now.toISOString().slice(0, 10);
    const plural = this.context.host.organisation.chapterLabel?.plural;
    const scope = result.chapterName
      ? slug(result.chapterName)
      : plural
        ? slug(`all ${plural}`)
        : 'all';
    const organisation = slug(this.context.host.organisation.shortName);
    return route.fulfill({
      status: 200,
      headers: {
        'content-disposition': `attachment; filename=${organisation}-report-${scope}-${result.period}-${date}.csv`,
      },
      contentType: 'text/csv; charset=utf-8',
      body: '\uFEFF' + this.csv(result),
    });
  }

  /** ExportReportHandler's sections, through CsvWriter's rules: every cell quoted, CRLF, a formula guard. */
  csv(report: MockReport): string {
    const minute = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : null);
    const text = (n: number | null) => (n === null ? null : String(n));
    const f = report.figures;
    const period = PERIOD_LABELS[report.period];
    const describe = period.toLowerCase();
    const label = this.context.host.organisation.chapterLabel;
    const singular = label?.singular ?? null;
    const lower = singular?.toLowerCase();
    const rows: (string | null)[][] = [
      ['Report', `${this.context.host.organisation.name} Reports`],
      ...(label
        ? [[label.singular, report.chapterName ?? `All ${label.plural.toLowerCase()}`]]
        : []),
      ['Period', period],
      ['From (UTC)', minute(report.from)],
      ['To (UTC)', minute(report.to)],
      ['Generated (UTC)', minute(report.to)],
      [],
      ['Figures'],
      ['Figure', 'Value', 'Context'],
      [
        'Members',
        text(f.members.value),
        f.members.newInPeriod === null ? null : `${f.members.newInPeriod} new in the ${describe}`,
      ],
      ['Events held', text(f.eventsHeld.value), `${f.eventsHeld.cancelled} cancelled`],
      [
        'RSVPs',
        text(f.rsvps.value),
        f.rsvps.checkedInPercent === null ? null : `${f.rsvps.checkedInPercent}% checked in`,
      ],
      [
        'Partners confirmed',
        text(f.partnersConfirmed.value),
        `of ${f.partnersConfirmed.inPipeline} in the pipeline`,
      ],
      ['Announcements', text(f.announcements.value), 'sent by leads'],
      [],
      ...(singular
        ? [
            [`Members by ${lower}`],
            [singular, 'Members'],
            ...report.membersByChapter.map((r) => [r.label, text(r.value)]),
            [],
          ]
        : []),
      ['New members by month'],
      ['Month', 'New members'],
      ...report.newMembersByMonth.map((m) => [
        m.soFar ? `${m.label} (so far)` : m.label,
        text(m.value),
      ]),
      [],
      [singular ? `Partner pipeline by ${lower}` : 'Partner pipeline'],
      [singular ?? 'Pipeline', 'Lead', 'In funnel', 'Confirmed'],
      ...report.partnerPipeline.map((r) => [
        r.chapter,
        text(r.lead),
        text(r.inFunnel),
        text(r.confirmed),
      ]),
      [],
      ['Events and attendance'],
      singular
        ? ['Event', 'Date (UTC)', singular, 'Status', 'Going', 'Checked in', 'Checked in %']
        : ['Event', 'Date (UTC)', 'Status', 'Going', 'Checked in', 'Checked in %'],
      ...report.events.map((e) => [
        e.title,
        minute(e.startsAt),
        ...(singular ? [e.chapter] : []),
        e.status,
        text(e.going),
        text(e.checkedIn),
        text(e.checkedInPercent),
      ]),
    ];
    const cell = (value: string | null) => {
      const guarded = /^[=+\-@\t\r]/.test(value ?? '') ? `'${value}` : (value ?? '');
      return `"${guarded.replace(/"/g, '""')}"`;
    };
    return rows.map((row) => row.map(cell).join(',') + '\r\n').join('');
  }

  /** The report for the filters, or the filter the server refuses. */
  report(
    chapterParam: string | null,
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
    // The active chapters in order; none, and the filter ignored, while chapters are off (L2-142).
    const label = this.context.host.organisation.chapterLabel;
    const chapters = this.context.chapters.options();
    let chapter: { id: string; name: string } | null = null;
    if (label && chapterParam) {
      chapter = chapters.find((c) => c.id === chapterParam) ?? null;
      if (!chapter)
        return {
          field: 'chapter',
          message: `Choose a ${label.singular.toLowerCase()} from the list.`,
        };
    }
    const city = chapter?.name ?? null;
    const members = city === null ? allMembers : allMembers.filter((p) => this.home(p) === city);
    const cityEvents = city === null ? events : events.filter((e) => this.place(e) === city);
    const started = cityEvents.filter((e) => inWindow(e.startsAt));
    const held = started.filter((e) => !e.isCancelled);
    const rsvps = held.flatMap((e) => e.rsvps).filter((r) => !r.isWalkIn);
    const checkedIn = rsvps.filter((r) => r.checkedInAt).length;
    const noChapter = label ? `No ${label.singular.toLowerCase()}` : WHOLE_PIPELINE;
    const pipeline = this.pipeline(
      city,
      chapters.map((c) => c.name),
      noChapter,
    );
    const sum = (pick: (r: (typeof pipeline)[number]) => number) =>
      pipeline.reduce((total, r) => total + pick(r), 0);
    const announcements = this.context.announcements.announcements.filter(
      (a) => inWindow(a.sentAt) && (city === null || this.homeOf(a.senderId) === city),
    );
    const table = this.eventRows(cityEvents, from, now);

    return {
      chapter: chapter?.id ?? null,
      chapterName: city,
      period,
      from: from?.toISOString() ?? null,
      to: now.toISOString(),
      chapters,
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
      membersByChapter: label ? this.membersByChapter(members, city) : [],
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

  private home(p: MockProfile): string | null {
    return this.context.chapters.nameOf(p.chapterId);
  }

  private homeOf(profileId: string): string | null {
    return this.context.chapters.nameOf(this.context.profiles.get(profileId)?.chapterId);
  }

  private place(e: MockEvent): string | null {
    return this.context.chapters.nameOf(e.chapterId);
  }

  /** Profiles whose account has a verified email and is not suspended. */
  private members(): MockProfile[] {
    const accounts = [...this.context.accounts.values()];
    return [...this.context.profiles.values()].filter((p) =>
      accounts.some((a) => a.profileId === p.id && a.verified && !a.suspended),
    );
  }

  private membersByChapter(members: MockProfile[], city: string | null) {
    if (city !== null) return [{ label: city, value: members.length }];
    const counts = new Map<string, number>();
    for (const home of members.map((m) => this.home(m)).filter((c): c is string => !blank(c))) {
      counts.set(home, (counts.get(home) ?? 0) + 1);
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

  /**
   * Lead, In funnel and Confirmed per owner home chapter; the period does not apply. Under All {chapters}: the
   * active chapters in order, then archived owner chapters by name, then "No {chapter}" when it has partners; while
   * chapters are off, one "Partner pipeline" row.
   */
  private pipeline(city: string | null, chapters: string[], noChapter: string) {
    const rows = new Map<
      string,
      { chapter: string; lead: number; inFunnel: number; confirmed: number }
    >();
    const row = (name: string) => {
      if (!rows.has(name)) rows.set(name, { chapter: name, lead: 0, inFunnel: 0, confirmed: 0 });
      return rows.get(name)!;
    };
    for (const p of this.context.partners.partners.filter((x) => !x.archivedAtUtc)) {
      const ownerCity = p.ownerId ? this.homeOf(p.ownerId) : null;
      const r = row(blank(ownerCity) ? noChapter : ownerCity!);
      if (p.stage === 'Lead') r.lead++;
      else if (p.stage === 'InFunnel') r.inFunnel++;
      else r.confirmed++;
    }
    if (city !== null) return [row(city)];
    const archived = [...rows.keys()]
      .filter((k) => k !== noChapter && !chapters.includes(k))
      .sort(byName);
    const named = [...chapters, ...archived].map(row);
    return rows.has(noChapter) || noChapter === WHOLE_PIPELINE ? [...named, row(noChapter)] : named;
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
        const chapter = this.context.host.organisation.chapterLabel
          ? (this.place(e) ?? `${this.context.host.organisation.shortName}-wide`)
          : null;
        const base = { id: e.id, title: e.title, startsAt: e.startsAt, chapter };
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
