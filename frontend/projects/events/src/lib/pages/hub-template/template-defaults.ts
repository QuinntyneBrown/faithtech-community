import {
  EventHubDto,
  HubContentByKind,
  HubSectionKind,
  HubTemplateAgendaItem,
  HubTemplateDetailDto,
} from '@faithtech-community/api';

import { HUB_SECTIONS } from '../../hub-sections';

/** The kinds a template holds a default for; the rest are filled in on each hub (L2-186 AC1). */
export const WITH_DEFAULTS: readonly HubSectionKind[] = [
  'Hero',
  'Agenda',
  'WhatToBring',
  'Tracks',
  'Process',
  'Rules',
  'DemoFormat',
  'Judging',
  'Worship',
  'Giving',
  'UpcomingEvents',
];

/** Why a section has no default, as docs/mocks/pages/organisation-hub-template says it. */
const FILLED_ON_EACH_HUB: Partial<Record<HubSectionKind, string>> = {
  Venue: 'Filled in on each hub, from its event’s venue.',
  Parking: 'Filled in on each hub: parking differs by venue.',
  Partners: 'Filled in on each hub, from Partners.',
  People: 'Filled in on each hub, from your members.',
  Links: 'Filled in on each hub: each event has its own forms.',
  Slides: 'Filled in on each hub, from Resources.',
};

/** Each kind's content with nothing in it, as a fresh hub reads it. */
const EMPTY: HubContentByKind = {
  Hero: { subtitle: null },
  Agenda: { items: [] },
  Venue: { directions: null },
  Parking: { note: null, options: [] },
  WhatToBring: { bring: [], onTheDay: [] },
  Partners: { partners: [], meet: null },
  Tracks: { tracks: [], goodLooksLike: [] },
  Process: { name: null, intro: null, stages: [] },
  Rules: { rules: [], note: null },
  People: { people: [] },
  Links: { submissionUrl: null, feedbackUrl: null, codeFreezeAt: null },
  DemoFormat: { minutes: null, questionMinutes: null, segments: [], tips: [] },
  Judging: { topScore: null, criteria: [], honors: [], note: null },
  Worship: { note: null, songs: [] },
  Slides: { slides: [] },
  Giving: { line: null },
  UpcomingEvents: { count: 3 },
};

/** The stand-in event's start: 9:00 am today, in the member's time zone (L2-186 AC4). */
export const STAND_IN_HOUR = 9;

function standInStart(): Date {
  const start = new Date();
  start.setHours(STAND_IN_HOUR, 0, 0, 0);
  return start;
}

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "9:00 am" for minutes after a 9:00 am start. */
export function clock(minutes: number): string {
  const total = STAND_IN_HOUR * 60 + minutes;
  const hours = Math.floor(total / 60) % 24;
  const mins = total % 60;
  return `${hours % 12 === 0 ? 12 : hours % 12}:${String(mins).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
}

/** What new hubs get for a section, as its row says it (L2-186 AC1). */
export function defaultSummary(
  kind: HubSectionKind,
  content: Record<string, unknown> | null,
): string {
  const filled = FILLED_ON_EACH_HUB[kind];
  if (filled) return filled;
  const c = (content ?? {}) as Record<string, unknown>;
  const list = (key: string) => (Array.isArray(c[key]) ? (c[key] as unknown[]) : []);
  const text = (key: string) => (typeof c[key] === 'string' && c[key] ? String(c[key]) : null);
  const parts: string[] = [];
  switch (kind) {
    case 'Hero':
    case 'Giving': {
      const line = text(kind === 'Hero' ? 'subtitle' : 'line');
      if (line) parts.push(`“${line}”`);
      break;
    }
    case 'Agenda': {
      const items = list('items') as HubTemplateAgendaItem[];
      if (items.length) {
        const times = items.map((i) => i.minutes);
        const first = clock(Math.min(...times));
        const last = clock(Math.max(...times));
        parts.push(
          `${n(items.length, 'row', 'rows')}, ${first === last ? first : `${first} to ${last}`}`,
        );
      }
      break;
    }
    case 'WhatToBring': {
      if (list('bring').length)
        parts.push(n(list('bring').length, 'thing to bring', 'things to bring'));
      if (list('onTheDay').length)
        parts.push(n(list('onTheDay').length, 'on-the-day note', 'on-the-day notes'));
      break;
    }
    case 'Tracks':
      if (list('tracks').length) parts.push(n(list('tracks').length, 'track', 'tracks'));
      break;
    case 'Process':
      if (list('stages').length) {
        if (text('name')) parts.push(text('name')!);
        parts.push(n(list('stages').length, 'stage', 'stages'));
      }
      break;
    case 'Rules':
      if (list('rules').length) parts.push(n(list('rules').length, 'rule', 'rules'));
      break;
    case 'DemoFormat':
      if (typeof c['minutes'] === 'number') parts.push(n(c['minutes'], 'minute', 'minutes'));
      if (list('segments').length) parts.push(n(list('segments').length, 'segment', 'segments'));
      if (typeof c['questionMinutes'] === 'number')
        parts.push(`${n(c['questionMinutes'], 'minute', 'minutes')} of questions`);
      break;
    case 'Judging':
      if (list('criteria').length) parts.push(n(list('criteria').length, 'criterion', 'criteria'));
      if (list('honors').length) parts.push(n(list('honors').length, 'honor', 'honors'));
      break;
    case 'Worship':
      if (list('songs').length) parts.push(n(list('songs').length, 'song', 'songs'));
      break;
    case 'UpcomingEvents':
      if (typeof c['count'] === 'number')
        parts.push(`Shows the next ${n(c['count'], 'event', 'events')}`);
      break;
  }
  return parts.length ? `Default: ${parts.join(' · ')}` : 'No default text yet';
}

/**
 * A hub the section wizards can open on for a template's defaults (ADR 0043): an event at 9:00 am today for 12 hours,
 * with each section's default, the Agenda's minutes turned into times.
 */
export function standInHub(template: HubTemplateDetailDto): { hub: EventHubDto; start: Date } {
  const start = standInStart();
  const end = new Date(start.getTime() + 12 * 60 * 60 * 1000);
  const sections = HUB_SECTIONS.map(({ kind }) => {
    const held = template.sections.find((s) => s.kind === kind);
    const stored = (held?.content ?? {}) as Record<string, unknown>;
    let content: unknown = { ...EMPTY[kind], ...stored };
    if (kind === 'Agenda') {
      const items = (
        Array.isArray(stored['items']) ? stored['items'] : []
      ) as HubTemplateAgendaItem[];
      content = {
        items: items.map((i) => ({
          startsAt: new Date(start.getTime() + i.minutes * 60000).toISOString(),
          title: i.title,
          detail: i.detail,
        })),
      };
    }
    return {
      kind,
      visible: held?.visible ?? false,
      state: 'Ready' as const,
      content: content as HubContentByKind[typeof kind],
    };
  });
  return {
    start,
    hub: {
      id: template.id,
      eventId: template.id,
      status: 'Draft',
      publishedAt: null,
      templateKey: template.id,
      link: '',
      event: {
        title: template.name,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        format: 'InPerson',
        venue: null,
        onlineLink: null,
        rsvpLink: '',
        isCancelled: false,
      },
      sections,
      organisation: template.organisation,
      upcomingEvents: [],
    },
  };
}

/** What a wizard saved, as the template stores it: an Agenda's times become minutes from the stand-in start. */
export function toTemplateContent(kind: HubSectionKind, content: unknown, start: Date): unknown {
  if (kind !== 'Agenda') return content;
  const items = (content as { items: { startsAt: string; title: string; detail: string | null }[] })
    .items;
  return {
    items: items.map((i) => ({
      minutes: Math.round((new Date(i.startsAt).getTime() - start.getTime()) / 60000),
      title: i.title,
      detail: i.detail,
    })),
  };
}
