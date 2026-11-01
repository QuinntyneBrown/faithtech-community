import { Route } from '@playwright/test';

import type { EventsCaller, MockEvent } from './mock-events';
import { holds, isOverride } from './role-definitions';

/**
 * Event hubs as the API keeps them (docs/detailed-designs/events/create-event-hub, ADR 0036): one per event, a Draft
 * from Blank with one section per kind, addressed through the event. The answers, status codes and words follow
 * EventHubs.cs (L2-153 to L2-155).
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
  templateKey: string;
  sections: MockHubSection[];
  createdAt: string;
  updatedAt: string;
}

/** What the hubs fake needs from the rest of the fake API. */
export interface EventHubsContext {
  now(): Date;
  event(id: string): MockEvent | undefined;
  addAuditEntry(entry: {
    action: string;
    summary: string;
    actorId?: string;
    targetType?: string;
    targetId?: string;
  }): void;
}

const canManageHubs = (caller: EventsCaller) => holds(caller, 'ManageEventHubs');

/** Hidden; Ready for the kinds the system fills and an in-person Venue with a venue; Needs info otherwise (L2-154 AC2). */
function state(section: MockHubSection, event: MockEvent): 'Ready' | 'NeedsInfo' | 'Hidden' {
  if (!section.visible) return 'Hidden';
  if (['Hero', 'Giving', 'UpcomingEvents'].includes(section.kind)) return 'Ready';
  if (section.kind === 'Venue' && event.format === 'InPerson' && event.venue?.trim())
    return 'Ready';
  return 'NeedsInfo';
}

export class MockEventHubs {
  readonly hubs: MockEventHub[] = [];
  /** The next create or save answers 500, to drive "We couldn’t save your hub". */
  private failSave = false;

  constructor(private readonly context: EventHubsContext) {}

  /** A hub as the wizard would leave it, for specs that start from one. */
  add(event: MockEvent, hidden: HubSectionKind[] = []): MockEventHub {
    const now = this.context.now().toISOString();
    const hub: MockEventHub = {
      id: `hub-${this.hubs.length + 1}`,
      eventId: event.id,
      status: 'Draft',
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

  /** Makes the next create or save fail with 500. */
  failNextSave(): void {
    this.failSave = true;
  }

  /** The event detail's hub fields (L2-153 AC1). */
  detail(event: MockEvent, caller: EventsCaller): { hubId: string | null; canManageHub: boolean } {
    return { hubId: this.of(event.id)?.id ?? null, canManageHub: canManageHubs(caller) };
  }

  /** Answers /api/events/{id}/hub; returns false for any other route. */
  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: EventsCaller | null,
  ): Promise<void> | false {
    const match = /^\/api\/events\/([^/]+)\/hub$/.exec(url.pathname);
    if (!match || !['GET', 'POST', 'PUT'].includes(method)) return false;
    if (!caller) return route.fulfill({ status: 401 });
    if (!canManageHubs(caller)) return route.fulfill({ status: 403 });
    const event = this.context.event(match[1]);
    if (!event) return route.fulfill({ status: 404 });
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
    return route.fulfill({
      status: 200,
      json: {
        id: hub.id,
        eventId: event.id,
        status: hub.status,
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
          state: state(s, event),
        })),
      },
    });
  }

  private save(
    route: Route,
    event: MockEvent,
    body: Record<string, unknown>,
    caller: EventsCaller,
  ): Promise<void> {
    const errors: Record<string, string[]> = {};
    if (body['templateKey'] !== 'blank')
      errors['TemplateKey'] = ['Choose a starting point from the list.'];
    const sections = Array.isArray(body['sections'])
      ? (body['sections'] as { kind?: unknown; visible?: unknown }[])
      : [];
    const kinds = sections.map((s) => String(s.kind ?? '').toLowerCase());
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
        (x) => x.kind.toLowerCase() === String(s.kind).toLowerCase(),
      );
      if (section) section.visible = s.visible === true;
    }
    hub.templateKey = 'blank';
    hub.updatedAt = this.context.now().toISOString();
    this.audit('event_hub.updated', `Saved the hub for ${event.title}`, hub, caller);
    return route.fulfill({ status: 204 });
  }

  /** Only an action allowed by AdministerOrganisation alone is audited (L2-155 AC2). */
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
