import { Route } from '@playwright/test';

import type { EventsCaller, MockEvent } from './mock-events';
import { holds, isOverride } from './role-definitions';

/**
 * Event hubs as the API keeps them (docs/detailed-designs/events/create-event-hub and fill-in-hub-sections, ADR 0036 and
 * 0038): one per event, a Draft from Blank with one section per kind, addressed through the event. Each section stores only
 * what the lead typed; the event, the organisation, members and upcoming events are read live. The answers, status codes
 * and words follow EventHubs.cs and HubSections.cs (L2-153 to L2-162).
 */
export const HUB_SECTION_KINDS = [
  'Hero',
  'Agenda',
  'Venue',
  'People',
  'Links',
  'Giving',
  'UpcomingEvents',
] as const;

export type HubSectionKind = (typeof HUB_SECTION_KINDS)[number];

export interface MockHubSection {
  kind: HubSectionKind;
  visible: boolean;
  content: Record<string, unknown>;
}

export interface MockEventHub {
  id: string;
  eventId: string;
  status: 'Draft' | 'Published';
  publishedAt: string | null;
  templateKey: string;
  sections: MockHubSection[];
  createdAt: string;
  updatedAt: string;
}

/** The organisation's facts the hub reads (L2-158). */
export interface HubOrganisation {
  name: string;
  shortName: string;
  givingLink?: string | null;
  givingText?: string | null;
}

/** What the hubs fake needs from the rest of the fake API. */
export interface EventHubsContext {
  now(): Date;
  event(id: string): MockEvent | undefined;
  events(): MockEvent[];
  chapterName(id: string | null): string | null;
  addAuditEntry(entry: {
    action: string;
    summary: string;
    actorId?: string;
    targetType?: string;
    targetId?: string;
  }): void;
}

/** What only the MockApi knows, connected after it builds the events fake. */
export interface EventHubsDirectory {
  organisation(): HubOrganisation;
  /** A member of the organisation, by profile id: name and featured photo. */
  member(profileId: string): { name: string; photoUrl: string | null } | undefined;
}

const canManageHubs = (caller: EventsCaller) => holds(caller, 'ManageEventHubs');

const HTTPS = 'Use a link that starts with https://';
const ROLES = ['Mentor', 'Judge', 'Speaker'];

type Errors = Record<string, string[]>;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().replace(/[ \t]+/g, ' ') : null;

const tooLong = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim().length > max;

function isHttps(value: unknown): boolean {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim()))
    return true;
  if (typeof value !== 'string' || value.trim().length > 500) return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

export class MockEventHubs {
  readonly hubs: MockEventHub[] = [];
  /** The next create, save, section save or reorder answers 500, to drive "Try again". */
  private failSave = false;
  private failLoad = false;
  private directory: EventHubsDirectory = {
    organisation: () => ({ name: 'FaithTech Community', shortName: 'FaithTech' }),
    member: () => undefined,
  };

  constructor(private readonly context: EventHubsContext) {}

  connect(directory: EventHubsDirectory): void {
    this.directory = directory;
  }

  /** A hub as the wizard would leave it, for specs that start from one. */
  add(event: MockEvent, hidden: HubSectionKind[] = []): MockEventHub {
    const now = this.context.now().toISOString();
    const hub: MockEventHub = {
      id: `hub-${this.hubs.length + 1}`,
      eventId: event.id,
      status: 'Draft',
      publishedAt: null,
      templateKey: 'blank',
      sections: HUB_SECTION_KINDS.map((kind) => ({
        kind,
        visible: !hidden.includes(kind),
        content: {},
      })),
      createdAt: now,
      updatedAt: now,
    };
    this.hubs.push(hub);
    return hub;
  }

  of(eventId: string): MockEventHub | undefined {
    return this.hubs.find((h) => h.eventId === eventId);
  }

  section(eventId: string, kind: HubSectionKind): MockHubSection | undefined {
    return this.of(eventId)?.sections.find((s) => s.kind === kind);
  }

  /** Arranges a section's content as its wizard would have saved it. */
  fill(eventId: string, kind: HubSectionKind, content: Record<string, unknown>): void {
    const section = this.section(eventId, kind);
    if (!section) throw new Error(`No ${kind} section on the hub of ${eventId}`);
    section.content = content;
  }

  /** Makes the next write fail with 500. */
  failNextSave(): void {
    this.failSave = true;
  }

  /** Makes the next read of a hub fail with 500, for the hub page's failed state. */
  failNextLoad(): void {
    this.failLoad = true;
  }

  /** Arranges a published hub, as Publish would leave it (L2-164 AC1). */
  publish(eventId: string): void {
    const hub = this.of(eventId);
    if (!hub) throw new Error(`No hub for ${eventId}`);
    hub.status = 'Published';
    hub.publishedAt = this.context.now().toISOString();
  }

  /** The event detail's hub fields (L2-153 AC1). */
  detail(event: MockEvent, caller: EventsCaller): { hubId: string | null; canManageHub: boolean } {
    return { hubId: this.of(event.id)?.id ?? null, canManageHub: canManageHubs(caller) };
  }

  /** Answers /api/events/{id}/hub and its sections; returns false for any other route. */
  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: EventsCaller | null,
  ): Promise<void> | false {
    const match =
      /^\/api\/events\/([^/]+)\/hub(?:\/sections\/([^/]+)|\/(publish|unpublish))?$/.exec(
        url.pathname,
      );
    if (!match) return false;
    const [, eventId, sectionPath, publishing] = match;
    const allowed = sectionPath ? ['PUT'] : publishing ? ['POST'] : ['GET', 'POST', 'PUT'];
    if (!allowed.includes(method)) return false;
    if (!caller) return route.fulfill({ status: 401 });
    if (!canManageHubs(caller)) return route.fulfill({ status: 403 });
    const event = this.context.event(eventId);
    if (!event) return route.fulfill({ status: 404 });
    if (publishing) return this.setPublished(route, event, publishing === 'publish', caller);
    if (sectionPath === 'order') return this.reorder(route, event, body, caller);
    if (sectionPath) return this.saveSection(route, event, sectionPath, body, caller);
    if (method === 'POST') return this.create(route, event, caller);
    if (method === 'GET') return this.get(route, event, url.origin);
    return this.save(route, event, body, caller);
  }

  private create(route: Route, event: MockEvent, caller: EventsCaller): Promise<void> {
    if (this.takeFailure()) return route.fulfill({ status: 500 });
    if (event.isCancelled)
      return route.fulfill({
        status: 409,
        json: { status: 409, detail: 'This event is cancelled, so it can’t have a hub.' },
      });
    if (this.of(event.id))
      return route.fulfill({
        status: 409,
        json: { status: 409, detail: 'This event already has a hub.' },
      });
    const hub = this.add(event);
    this.audit('event_hub.created', `Created the hub for ${event.title}`, hub, caller);
    return route.fulfill({
      status: 201,
      headers: { Location: `/api/events/${event.id}/hub` },
      json: { id: hub.id },
    });
  }

  private get(route: Route, event: MockEvent, origin: string): Promise<void> {
    const hub = this.of(event.id);
    if (!hub) return route.fulfill({ status: 404 });
    if (this.failLoad) {
      this.failLoad = false;
      return route.fulfill({ status: 500 });
    }
    const organisation = this.directory.organisation();
    const upcoming = this.section(event.id, 'UpcomingEvents')?.content['count'];
    return route.fulfill({
      status: 200,
      json: {
        id: hub.id,
        eventId: event.id,
        status: hub.status,
        publishedAt: hub.publishedAt,
        templateKey: hub.templateKey,
        link: `${origin}/public/events/${event.id}/hub`,
        event: {
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          format: event.format,
          venue: event.venue,
          onlineLink: event.onlineLink,
          rsvpLink: `${origin}/public/events/${event.id}`,
          isCancelled: event.isCancelled,
        },
        sections: hub.sections.map((s) => ({
          kind: s.kind,
          visible: s.visible,
          state: this.state(s, event, organisation),
          content: this.contentOf(s),
        })),
        organisation: {
          name: organisation.name,
          shortName: organisation.shortName,
          givingLink: organisation.givingLink ?? null,
          givingText: organisation.givingText ?? null,
        },
        upcomingEvents: this.upcoming(event, typeof upcoming === 'number' ? upcoming : 3),
      },
    });
  }

  private save(
    route: Route,
    event: MockEvent,
    body: Record<string, unknown>,
    caller: EventsCaller,
  ): Promise<void> {
    const errors: Errors = {};
    if (body['templateKey'] !== 'blank')
      errors['TemplateKey'] = ['Choose a starting point from the list.'];
    const sections = list(body['sections']);
    const kinds = sections.map((s) => String(s['kind'] ?? '').toLowerCase());
    const known = HUB_SECTION_KINDS.map((k) => k.toLowerCase());
    if (kinds.some((k) => !known.includes(k)) || new Set(kinds).size !== kinds.length)
      errors['Sections'] = ['Choose sections from the list.'];
    if (Object.keys(errors).length)
      return route.fulfill({ status: 400, json: { status: 400, errors } });
    const hub = this.of(event.id);
    if (!hub) return route.fulfill({ status: 404 });
    if (this.takeFailure()) return route.fulfill({ status: 500 });
    for (const s of sections) {
      const section = hub.sections.find(
        (x) => x.kind.toLowerCase() === String(s['kind']).toLowerCase(),
      );
      if (section) section.visible = s['visible'] === true;
    }
    hub.templateKey = 'blank';
    hub.updatedAt = this.context.now().toISOString();
    this.audit('event_hub.updated', `Saved the hub for ${event.title}`, hub, caller);
    return route.fulfill({ status: 204 });
  }

  /** PUT /hub/sections/order (L2-156 AC4): every kind exactly once. */
  private reorder(
    route: Route,
    event: MockEvent,
    body: Record<string, unknown>,
    caller: EventsCaller,
  ): Promise<void> {
    const kinds = Array.isArray(body['kinds']) ? (body['kinds'] as unknown[]).map(String) : [];
    const known = HUB_SECTION_KINDS.map((k) => k.toLowerCase());
    const lower = kinds.map((k) => k.toLowerCase());
    if (
      lower.length !== known.length ||
      new Set(lower).size !== lower.length ||
      lower.some((k) => !known.includes(k))
    )
      return route.fulfill({
        status: 400,
        json: { status: 400, errors: { kinds: ['Choose sections from the list.'] } },
      });
    const hub = this.of(event.id);
    if (!hub) return route.fulfill({ status: 404 });
    if (this.takeFailure()) return route.fulfill({ status: 500 });
    hub.sections.sort(
      (a, b) => lower.indexOf(a.kind.toLowerCase()) - lower.indexOf(b.kind.toLowerCase()),
    );
    this.audit('event_hub.updated', `Reordered the hub for ${event.title}`, hub, caller);
    return route.fulfill({ status: 204 });
  }

  /** PUT /hub/sections/{kind} (L2-157 AC2, AC3): the kind's schema, then what needs the data set. */
  private saveSection(
    route: Route,
    event: MockEvent,
    kindPath: string,
    body: Record<string, unknown>,
    caller: EventsCaller,
  ): Promise<void> {
    const hub = this.of(event.id);
    const kind = HUB_SECTION_KINDS.find((k) => k.toLowerCase() === kindPath.toLowerCase());
    if (!hub || !kind) return route.fulfill({ status: 404 });
    const { content, errors } = this.validate(kind, body, hub);
    if (errors) return route.fulfill({ status: 400, json: { status: 400, errors } });
    if (this.takeFailure()) return route.fulfill({ status: 500 });
    hub.sections.find((s) => s.kind === kind)!.content = content!;
    hub.updatedAt = this.context.now().toISOString();
    this.audit('event_hub.updated', `Saved ${kind} on the hub for ${event.title}`, hub, caller);
    return route.fulfill({ status: 204 });
  }

  private validate(
    kind: HubSectionKind,
    body: Record<string, unknown>,
    hub: MockEventHub,
  ): { content?: Record<string, unknown>; errors?: Errors } {
    const errors: Errors = {};
    const add = (field: string, message: string) => (errors[field] ??= [message]);
    let content: Record<string, unknown> = {};
    switch (kind) {
      case 'Hero':
        if (tooLong(body['subtitle'], 140)) add('subtitle', 'Use 140 characters or fewer.');
        content = { subtitle: text(body['subtitle']) };
        break;
      case 'Agenda': {
        const items = list(body['items']);
        if (items.length > 40) add('items', 'You can add up to 40 rows.');
        else
          items.forEach((item, i) => {
            if (!item['startsAt']) add(`items[${i}].startsAt`, 'Enter a time.');
            if (!text(item['title'])) add(`items[${i}].title`, 'Say what’s happening.');
            else if (tooLong(item['title'], 100))
              add(`items[${i}].title`, 'Use 100 characters or fewer.');
            if (tooLong(item['detail'], 200))
              add(`items[${i}].detail`, 'Use 200 characters or fewer.');
          });
        content = {
          items: items.map((item) => ({
            startsAt: new Date(String(item['startsAt'])).toISOString(),
            title: text(item['title']),
            detail: text(item['detail']),
          })),
        };
        break;
      }
      case 'Venue':
        if (tooLong(body['directions'], 500)) add('directions', 'Use 500 characters or fewer.');
        content = { directions: text(body['directions']) };
        break;
      case 'People': {
        const people = list(body['people']);
        if (people.length > 60) add('people', 'You can add up to 60 people.');
        else
          people.forEach((p, i) => {
            if (p['profileId']) {
              if (!this.directory.member(String(p['profileId'])))
                add(`people[${i}].profileId`, 'Choose a member from the search.');
            } else if (!text(p['name'])) add(`people[${i}].name`, 'Enter their name.');
            else if (tooLong(p['name'], 80))
              add(`people[${i}].name`, 'Use 80 characters or fewer.');
            if (!p['profileId'] && tooLong(p['line'], 120))
              add(`people[${i}].line`, 'Use 120 characters or fewer.');
            if (!ROLES.includes(String(p['role'] ?? '')))
              add(`people[${i}].role`, 'Choose mentor, judge or speaker.');
          });
        content = {
          people: people.map((p) =>
            p['profileId']
              ? { profileId: String(p['profileId']), name: null, line: null, role: p['role'] }
              : { profileId: null, name: text(p['name']), line: text(p['line']), role: p['role'] },
          ),
        };
        break;
      }
      case 'Links': {
        if (!isHttps(body['submissionUrl'])) add('submissionUrl', HTTPS);
        if (!isHttps(body['feedbackUrl'])) add('feedbackUrl', HTTPS);
        const freeze = body['codeFreezeAt']
          ? new Date(String(body['codeFreezeAt'])).getTime()
          : null;
        const rows = list(hub.sections.find((s) => s.kind === 'Agenda')?.content['items']);
        if (
          freeze !== null &&
          !Object.keys(errors).length &&
          !rows.some((r) => new Date(String(r['startsAt'])).getTime() === freeze)
        )
          add('codeFreezeAt', 'Pick a time from the agenda.');
        content = {
          submissionUrl: text(body['submissionUrl']),
          feedbackUrl: text(body['feedbackUrl']),
          codeFreezeAt: freeze === null ? null : new Date(freeze).toISOString(),
        };
        break;
      }
      case 'Giving':
        if (tooLong(body['line'], 200)) add('line', 'Use 200 characters or fewer.');
        content = { line: text(body['line']) };
        break;
      case 'UpcomingEvents': {
        const count = body['count'];
        if (count !== null && count !== undefined && !(Number(count) >= 1 && Number(count) <= 6))
          add('count', 'Choose between 1 and 6.');
        content = { count: count === null || count === undefined ? null : Number(count) };
        break;
      }
    }
    return Object.keys(errors).length ? { errors } : { content };
  }

  /** The section's content as the API returns it: defaults filled, People members read live (L2-161 AC2). */
  private contentOf(section: MockHubSection): Record<string, unknown> {
    const c = section.content;
    switch (section.kind) {
      case 'Hero':
        return { subtitle: c['subtitle'] ?? null };
      case 'Agenda':
        return { items: list(c['items']) };
      case 'Venue':
        return { directions: c['directions'] ?? null };
      case 'People':
        return {
          people: list(c['people']).flatMap((p): Record<string, unknown>[] => {
            if (!p['profileId'])
              return [
                {
                  profileId: null,
                  name: p['name'],
                  line: p['line'] ?? null,
                  role: p['role'],
                  photoUrl: null,
                },
              ];
            const member = this.directory.member(String(p['profileId']));
            return member
              ? [
                  {
                    profileId: p['profileId'],
                    name: member.name,
                    line: null,
                    role: p['role'],
                    photoUrl: member.photoUrl,
                  },
                ]
              : [];
          }),
        };
      case 'Links':
        return {
          submissionUrl: c['submissionUrl'] ?? null,
          feedbackUrl: c['feedbackUrl'] ?? null,
          codeFreezeAt: c['codeFreezeAt'] ?? null,
        };
      case 'Giving':
        return { line: c['line'] ?? null };
      case 'UpcomingEvents':
        return { count: typeof c['count'] === 'number' ? c['count'] : 3 };
    }
  }

  /** Hidden; otherwise Ready when the section has what visitors need (L2-156 AC2). */
  private state(
    section: MockHubSection,
    event: MockEvent,
    organisation: HubOrganisation,
  ): 'Ready' | 'NeedsInfo' | 'Hidden' {
    if (!section.visible) return 'Hidden';
    const c = section.content;
    const ready = {
      Hero: true,
      UpcomingEvents: true,
      Agenda: list(c['items']).length > 0,
      Venue: event.format === 'InPerson' && !!event.venue?.trim(),
      People: list(c['people']).length > 0,
      Links: !!c['submissionUrl'] || !!c['feedbackUrl'],
      Giving: !!organisation.givingLink,
    }[section.kind];
    return ready ? 'Ready' : 'NeedsInfo';
  }

  /** The chapter's next public events after now, or the organisation's for an organisation-wide event (L2-162 AC2). */
  private upcoming(event: MockEvent, count: number) {
    const now = this.context.now().getTime();
    return this.context
      .events()
      .filter(
        (e) =>
          e.id !== event.id &&
          e.visibility === 'Public' &&
          !e.isCancelled &&
          new Date(e.startsAt).getTime() > now &&
          (event.chapterId === null || e.chapterId === event.chapterId),
      )
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, count)
      .map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        format: e.format,
        venue: e.venue,
        chapterName: this.context.chapterName(e.chapterId),
      }));
  }

  /** Publish or unpublish (L2-164): refuses nothing; every status change is audited, override or not. */
  private setPublished(
    route: Route,
    event: MockEvent,
    publish: boolean,
    caller: EventsCaller,
  ): Promise<void> {
    const hub = this.of(event.id);
    if (!hub) return route.fulfill({ status: 404 });
    if (this.takeFailure()) return route.fulfill({ status: 500 });
    if (!publish && hub.status === 'Draft') return route.fulfill({ status: 204 });
    const now = this.context.now().toISOString();
    hub.status = publish ? 'Published' : 'Draft';
    hub.publishedAt = publish ? now : null;
    hub.updatedAt = now;
    this.context.addAuditEntry({
      action: publish ? 'event_hub.published' : 'event_hub.unpublished',
      summary: `${publish ? 'Published' : 'Unpublished'} the hub for ${event.title}`,
      actorId: caller.profileId,
      targetType: 'EventHub',
      targetId: hub.id,
    });
    return route.fulfill({ status: 204 });
  }

  /** Only an action allowed by AdministerOrganisation alone is audited (L2-155 AC2, L2-157 AC5). */
  private audit(action: string, summary: string, hub: MockEventHub, caller: EventsCaller): void {
    if (!isOverride(caller, 'ManageEventHubs')) return;
    this.context.addAuditEntry({
      action,
      summary,
      actorId: caller.profileId,
      targetType: 'EventHub',
      targetId: hub.id,
    });
  }

  private takeFailure(): boolean {
    const fail = this.failSave;
    this.failSave = false;
    return fail;
  }
}
