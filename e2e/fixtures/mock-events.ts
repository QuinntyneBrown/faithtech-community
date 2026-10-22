import { Route } from '@playwright/test';

/** An RSVP as the Rsvps table holds it: a member's profile id, or a guest's name and email. */
export interface MockRsvp {
  id: string;
  profileId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  createdAt: string;
  /** The secret in a guest's cancel link (the server keeps only its hash). */
  cancelToken?: string;
}

/** An event as the Events table holds it (FaithTech.Community.Domain.Events.Event). */
export interface MockEvent {
  id: string;
  title: string;
  description: string;
  type: 'Gathering' | 'BuildersNight' | 'Hackathon' | 'PrayerAndPlanning' | 'Panel';
  startsAt: string;
  endsAt: string;
  city: string;
  format: 'InPerson' | 'Online';
  venue: string | null;
  onlineLink: string | null;
  capacity: number | null;
  visibility: 'MembersOnly' | 'Public';
  isCancelled: boolean;
  cancellationReason: string | null;
  sequence: number;
  createdById: string;
  rsvps: MockRsvp[];
}

/** The signed-in caller as the events fake needs it. */
export interface EventsCaller {
  profileId: string;
  roles: string[];
  email?: string;
}

/** A member's profile as the events fake reads it (name for RSVP lists, roles for the host line). */
export interface EventsProfile {
  name: string;
  roles: string[];
}

/** A queued email, as the outbox would send it. */
export interface MockEmail {
  to: string;
  subject: string;
  body: string;
  attachment: { fileName: string; contentType: string } | null;
}

const LIST_FILTERS = ['upcoming', 'past', 'hackathons', 'online'];
const MANAGERS = ['EventLead', 'CityLead', 'SystemAdmin'];
const LEADS = ['CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead'];
const HOST_ROLES: [string, string][] = [
  ['EventLead', 'Event Lead'],
  ['CityLead', 'City Lead'],
  ['SystemAdmin', 'System Admin'],
];

/** EventPermissions: who sees the RSVP list, guest emails and the CSV export (L2-022). */
const seesList = (c: EventsCaller) =>
  c.roles.some((r) => LEADS.includes(r) || r === 'Staff' || r === 'SystemAdmin');
const seesEmails = (c: EventsCaller) =>
  c.roles.some((r) => LEADS.includes(r) || r === 'SystemAdmin');

/** EventFileNames.Slug: "toronto-builders-night". */
export function slug(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return words.slice(0, 60).replace(/-+$/, '') || 'event';
}
const TYPES = ['Gathering', 'BuildersNight', 'Hackathon', 'PrayerAndPlanning', 'Panel'];

function canManage(caller: EventsCaller): boolean {
  return caller.roles.some((r) => MANAGERS.includes(r));
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** SaveEventValidator's rules and words. */
function validate(body: Record<string, unknown>): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const online = body['format'] === 'Online';
  if (!text(body['title'])) errors['Title'] = ['Give the event a title people will recognise.'];
  if (!TYPES.includes(String(body['type']))) errors['Type'] = ['Choose a type from the list.'];
  if (!(String(body['endsAt']) > String(body['startsAt']))) {
    errors['EndsAt'] = ['The end time must be after the start time.'];
  }
  if (!text(body['city'])) errors['City'] = ['Enter the city the event is in.'];
  if (!online && !text(body['venue']))
    errors['Venue'] = ['Enter a venue address, or choose Online.'];
  if (online && !text(body['onlineLink'])) {
    errors['OnlineLink'] = ['Enter the joining link, or choose In person.'];
  } else if (online && !/^https?:\/\//.test(text(body['onlineLink']))) {
    errors['OnlineLink'] = ['Enter a link that starts with https://'];
  }
  const capacity = body['capacity'];
  if (capacity !== null && capacity !== undefined && !(Number(capacity) >= 1)) {
    errors['Capacity'] = ['Capacity must be at least 1, or leave it empty for no limit.'];
  }
  return errors;
}

/** The stored fields of a valid request; the field the format does not use is dropped. */
function fields(body: Record<string, unknown>): Partial<MockEvent> {
  const online = body['format'] === 'Online';
  return {
    title: text(body['title']),
    description: text(body['description']),
    type: body['type'] as MockEvent['type'],
    startsAt: new Date(String(body['startsAt'])).toISOString(),
    endsAt: new Date(String(body['endsAt'])).toISOString(),
    city: text(body['city']),
    format: online ? 'Online' : 'InPerson',
    venue: online ? null : text(body['venue']),
    onlineLink: online ? text(body['onlineLink']) : null,
    capacity: (body['capacity'] as number | null) ?? null,
    visibility: body['visibility'] as MockEvent['visibility'],
  };
}

/**
 * Plays the events endpoints (backend/src/FaithTech.Community.Api/Endpoints/EventsEndpoints.cs)
 * over an in-memory list of events, with the same filters and permission rules.
 */
export class MockEvents {
  readonly events: MockEvent[] = [];
  /** In-app notifications the events endpoints recorded (the Notifications table). */
  readonly notifications: {
    recipientId: string;
    kind: string;
    title: string;
    linkPath: string;
  }[] = [];

  /** Emails the events endpoints sent (confirmations with the .ics, cancellations). */
  readonly emails: MockEmail[] = [];

  constructor(
    private readonly now: () => Date,
    private readonly profile: (id: string) => EventsProfile | undefined = () => undefined,
  ) {}

  /** An event as a lead would create it; give `startsInDays` relative to the fake's "now". */
  add(event: Partial<MockEvent> & { title: string }, startsInDays = 7, hours = 2): MockEvent {
    const starts = new Date(this.now().getTime() + startsInDays * 24 * 60 * 60 * 1000);
    const full: MockEvent = {
      id: `event-${this.events.length + 1}`,
      description: `About ${event.title}.`,
      type: 'Gathering',
      startsAt: starts.toISOString(),
      endsAt: new Date(starts.getTime() + hours * 60 * 60 * 1000).toISOString(),
      city: 'Toronto',
      format: 'InPerson',
      venue: 'Kestrel Labs, 220 King St W',
      onlineLink: null,
      capacity: null,
      visibility: 'MembersOnly',
      isCancelled: false,
      cancellationReason: null,
      sequence: 0,
      createdById: 'profile-1',
      rsvps: [],
      ...event,
    };
    this.events.push(full);
    return full;
  }

  /** A guest's RSVP, as the public page would take it, `daysAgo` before the fake's "now". */
  addGuest(event: MockEvent, name: string, email: string, daysAgo = 1): MockRsvp {
    return this.push(event, null, name, email, daysAgo);
  }

  /** A member's RSVP, `daysAgo` before the fake's "now". */
  addMember(event: MockEvent, profileId: string, daysAgo = 1): MockRsvp {
    return this.push(event, profileId, null, null, daysAgo);
  }

  private push(
    event: MockEvent,
    profileId: string | null,
    guestName: string | null,
    guestEmail: string | null,
    daysAgo: number,
  ): MockRsvp {
    const rsvp: MockRsvp = {
      id: `${event.id}-rsvp-${event.rsvps.length + 1}`,
      profileId,
      guestName,
      guestEmail,
      createdAt: new Date(this.now().getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    };
    event.rsvps.push(rsvp);
    return rsvp;
  }

  /** Adds `count` member RSVPs from people who are not otherwise in the fake. */
  addRsvps(event: MockEvent, count: number): void {
    for (let i = 0; i < count; i++) {
      event.rsvps.push({
        id: `${event.id}-rsvp-${event.rsvps.length + 1}`,
        profileId: `${event.id}-member-${event.rsvps.length + 1}`,
        guestName: null,
        guestEmail: null,
        createdAt: this.now().toISOString(),
      });
    }
  }

  /** Answers the request when it is an events route; returns false when it is not one. */
  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: EventsCaller | null,
  ): Promise<void> | false {
    if (method === 'GET' && url.pathname === '/api/events') return this.list(route, url, caller);
    if (method === 'POST' && url.pathname === '/api/events')
      return this.create(route, body, caller);
    const one = /^\/api\/events\/([^/]+)$/.exec(url.pathname);
    if (one && method === 'GET') return this.get(route, one[1], caller);
    if (one && method === 'PUT') return this.update(route, one[1], body, caller);
    const publicRoute = /^\/api\/public\/events\/([^/]+)(\/rsvps(?:\/cancel)?)?$/.exec(
      url.pathname,
    );
    if (publicRoute && method === 'GET' && !publicRoute[2])
      return this.getPublic(route, publicRoute[1]);
    if (publicRoute && method === 'POST' && publicRoute[2] === '/rsvps')
      return this.guestRsvp(route, publicRoute[1], body);
    if (publicRoute && method === 'POST' && publicRoute[2] === '/rsvps/cancel')
      return this.cancelGuest(route, publicRoute[1], body);
    const rsvps = /^\/api\/events\/([^/]+)\/rsvps(\/me|\.csv)?$/.exec(url.pathname);
    if (rsvps && method === 'POST' && !rsvps[2]) return this.rsvp(route, rsvps[1], caller);
    if (rsvps && method === 'DELETE' && rsvps[2] === '/me')
      return this.cancelRsvp(route, rsvps[1], caller);
    if (rsvps && method === 'GET' && rsvps[2] === '.csv')
      return this.exportRsvps(route, rsvps[1], caller);
    return false;
  }

  /** Guest RSVPs and cancellations taken in this test: the guest-rsvp limit is 10 an hour per address. */
  guestRequests = 0;

  private publicEvent(id: string): MockEvent | undefined {
    return this.events.find((e) => e.id === id && e.visibility === 'Public');
  }

  /** GET /api/public/events/{id} (L2-023 AC1, AC3): anonymous; members-only and unknown are 404. */
  private getPublic(route: Route, id: string): Promise<void> {
    const event = this.publicEvent(id);
    if (!event) return route.fulfill({ status: 404 });
    return route.fulfill({
      status: 200,
      json: {
        id: event.id,
        title: event.title,
        description: event.description,
        type: event.type,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        city: event.city,
        format: event.format,
        venue: event.venue,
        rsvpCount: event.rsvps.length,
        isFull: event.capacity !== null && event.rsvps.length >= event.capacity,
        isCancelled: event.isCancelled,
        cancellationReason: event.cancellationReason,
      },
    });
  }

  private limited(route: Route): Promise<void> | null {
    if (++this.guestRequests > 10) return route.fulfill({ status: 429 });
    return null;
  }

  /** POST /api/public/events/{id}/rsvps (L2-023 AC2, AC4, AC5): no account, one RSVP per email. */
  private guestRsvp(route: Route, id: string, body: Record<string, unknown>): Promise<void> {
    const limited = this.limited(route);
    if (limited) return limited;
    const name = text(body['name']);
    const email = text(body['email']);
    const errors: Record<string, string[]> = {};
    if (!name) errors['Name'] = ['Enter your name so the host knows who’s coming.'];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors['Email'] = ['Enter an email like name@example.org.'];
    if (Object.keys(errors).length)
      return route.fulfill({ status: 400, json: { status: 400, errors } });
    const event = this.publicEvent(id);
    if (!event) return route.fulfill({ status: 404 });
    let rsvp = event.rsvps.find((r) => r.guestEmail?.toLowerCase() === email.toLowerCase());
    if (!rsvp) {
      const refusal = this.refusal(event);
      if (refusal) return route.fulfill({ status: 409, json: { status: 409, detail: refusal } });
      rsvp = this.addGuest(event, name, email, 0);
    }
    rsvp.cancelToken = `cancel-${rsvp.id}-${this.emails.length + 1}`;
    const confirmation = this.confirmation(event, email);
    confirmation.body += ` Cancel: /public/events/${event.id}/cancel-rsvp?token=${rsvp.cancelToken}`;
    this.emails.push(confirmation);
    return route.fulfill({ status: 204 });
  }

  /** POST /api/public/events/{id}/rsvps/cancel (L2-023 AC6): the cancel link's token, no sign-in. */
  private cancelGuest(route: Route, id: string, body: Record<string, unknown>): Promise<void> {
    const limited = this.limited(route);
    if (limited) return limited;
    const event = this.events.find((e) => e.id === id);
    const rsvp = event?.rsvps.find((r) => r.cancelToken && r.cancelToken === body['token']);
    if (!event || !rsvp) return route.fulfill({ status: 404 });
    event.rsvps = event.rsvps.filter((r) => r !== rsvp);
    return route.fulfill({ status: 204 });
  }

  /** The cancel link in the latest confirmation sent to a guest, as a path in the web app. */
  cancelLinkFor(email: string): string {
    const body = [...this.emails].reverse().find((m) => m.to === email)?.body ?? '';
    const link = / Cancel: (\S+)$/.exec(body)?.[1];
    if (!link) throw new Error(`No cancel link was sent to ${email}`);
    return link;
  }

  /** RsvpHandler.Refusal: why the event takes no new RSVPs. */
  refusal(event: MockEvent): string | null {
    if (event.isCancelled) return 'This event was cancelled.';
    if (this.now().toISOString() >= event.startsAt) return 'This event has already started.';
    if (event.capacity !== null && event.rsvps.length >= event.capacity)
      return 'This event is full.';
    return null;
  }

  /** POST /api/events/{id}/rsvps (L2-022 AC1): once per member, with an in-app and email confirmation. */
  private rsvp(route: Route, id: string, caller: EventsCaller | null): Promise<void> {
    if (!caller) return route.fulfill({ status: 401 });
    const event = this.events.find((e) => e.id === id);
    if (!event) return route.fulfill({ status: 404 });
    if (event.rsvps.some((r) => r.profileId === caller.profileId))
      return route.fulfill({ status: 204 });
    const refusal = this.refusal(event);
    if (refusal) return route.fulfill({ status: 409, json: { status: 409, detail: refusal } });
    this.addMember(event, caller.profileId, 0);
    this.notifications.push({
      recipientId: caller.profileId,
      kind: 'RsvpConfirmed',
      title: `You’re going to ${event.title}`,
      linkPath: `/events/${event.id}`,
    });
    if (caller.email) this.emails.push(this.confirmation(event, caller.email));
    return route.fulfill({ status: 204 });
  }

  /** The confirmation email with the event's .ics attached. */
  confirmation(event: MockEvent, to: string): MockEmail {
    return {
      to,
      subject: `You’re going to ${event.title}`,
      body: `You’re going to ${event.title}.`,
      attachment: { fileName: `${slug(event.title)}.ics`, contentType: 'text/calendar' },
    };
  }

  /** DELETE /api/events/{id}/rsvps/me (L2-022 AC2). */
  private cancelRsvp(route: Route, id: string, caller: EventsCaller | null): Promise<void> {
    if (!caller) return route.fulfill({ status: 401 });
    const event = this.events.find((e) => e.id === id);
    const mine = event?.rsvps.find((r) => r.profileId === caller.profileId);
    if (!event || !mine) return route.fulfill({ status: 404 });
    event.rsvps = event.rsvps.filter((r) => r !== mine);
    return route.fulfill({ status: 204 });
  }

  /** GET /api/events/{id}/rsvps.csv (L2-022 AC5): leads and System Admins only. */
  private exportRsvps(route: Route, id: string, caller: EventsCaller | null): Promise<void> {
    if (!caller) return route.fulfill({ status: 401 });
    if (!seesEmails(caller)) return route.fulfill({ status: 403 });
    const event = this.events.find((e) => e.id === id);
    if (!event) return route.fulfill({ status: 404 });
    const rows = event.rsvps.map((r) =>
      [this.rsvpName(r), r.profileId ? 'Member' : 'Guest', r.guestEmail ?? '', r.createdAt].join(
        ',',
      ),
    );
    return route.fulfill({
      status: 200,
      headers: { 'content-disposition': `attachment; filename=${slug(event.title)}-rsvps.csv` },
      contentType: 'text/csv',
      body: ["Name,Member or guest,Guest email,RSVP'd (UTC)", ...rows].join('\r\n'),
    });
  }

  private rsvpName(r: MockRsvp): string {
    return r.guestName ?? this.profile(r.profileId ?? '')?.name ?? 'A former member';
  }

  /** GET /api/events/{id}: every signed-in member sees every event. */
  private get(route: Route, id: string, caller: EventsCaller | null): Promise<void> {
    if (!caller) return route.fulfill({ status: 401 });
    const event = this.events.find((e) => e.id === id);
    if (!event) return route.fulfill({ status: 404 });
    return route.fulfill({ status: 200, json: this.detail(event, caller) });
  }

  /** POST /api/events (L2-020): event managers only, SaveEventValidator's rules. */
  private create(
    route: Route,
    body: Record<string, unknown>,
    caller: EventsCaller | null,
  ): Promise<void> {
    if (!caller) return route.fulfill({ status: 401 });
    const errors = validate(body);
    if (Object.keys(errors).length)
      return route.fulfill({ status: 400, json: { status: 400, errors } });
    if (!canManage(caller)) return route.fulfill({ status: 403 });
    const event = this.add({ title: '', ...fields(body), createdById: caller.profileId });
    return route.fulfill({
      status: 201,
      headers: { location: `/api/events/${event.id}` },
      json: { id: event.id },
    });
  }

  /** PUT /api/events/{id} (L2-020): raises the sequence and notifies members who RSVP'd. */
  private update(
    route: Route,
    id: string,
    body: Record<string, unknown>,
    caller: EventsCaller | null,
  ): Promise<void> {
    if (!caller) return route.fulfill({ status: 401 });
    const errors = validate(body);
    if (Object.keys(errors).length)
      return route.fulfill({ status: 400, json: { status: 400, errors } });
    if (!canManage(caller)) return route.fulfill({ status: 403 });
    const event = this.events.find((e) => e.id === id);
    if (!event) return route.fulfill({ status: 404 });
    if (event.isCancelled) {
      return route.fulfill({
        status: 409,
        json: { status: 409, detail: 'This event is cancelled, so it can’t be edited.' },
      });
    }
    Object.assign(event, fields(body));
    event.sequence++;
    for (const rsvp of event.rsvps) {
      if (rsvp.profileId && rsvp.profileId !== caller.profileId) {
        this.notifications.push({
          recipientId: rsvp.profileId,
          kind: 'EventChanged',
          title: `${event.title} changed. Check the new details.`,
          linkPath: `/events/${event.id}`,
        });
      }
    }
    return route.fulfill({ status: 204 });
  }

  private detail(event: MockEvent, caller: EventsCaller) {
    const host = this.profile(event.createdById);
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      type: event.type,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      city: event.city,
      format: event.format,
      venue: event.venue,
      onlineLink: event.onlineLink,
      capacity: event.capacity,
      visibility: event.visibility,
      rsvpCount: event.rsvps.length,
      isFull: event.capacity !== null && event.rsvps.length >= event.capacity,
      isCancelled: event.isCancelled,
      cancellationReason: event.cancellationReason,
      hostName: host?.name ?? null,
      hostRole: HOST_ROLES.find(([role]) => host?.roles.includes(role))?.[1] ?? null,
      callerHasRsvp: event.rsvps.some((r) => r.profileId === caller.profileId),
      canManage: canManage(caller),
      canExportRsvps: seesEmails(caller),
      rsvps: seesList(caller)
        ? [...event.rsvps]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((r) => ({
              profileId: r.profileId,
              name: this.rsvpName(r),
              isGuest: r.profileId === null,
              guestEmail: r.profileId === null && seesEmails(caller) ? r.guestEmail : null,
              rsvpedAt: r.createdAt,
            }))
        : null,
    };
  }

  /** GET /api/events?filter=&city= (L2-021). */
  private list(route: Route, url: URL, caller: EventsCaller | null): Promise<void> {
    if (!caller) return route.fulfill({ status: 401 });
    const filter = (url.searchParams.get('filter') ?? 'upcoming').toLowerCase();
    if (!LIST_FILTERS.includes(filter)) {
      return route.fulfill({
        status: 400,
        json: {
          status: 400,
          errors: { filter: ['Filter by Upcoming, Past, Hackathons or Online.'] },
        },
      });
    }
    const now = this.now().toISOString();
    const city = url.searchParams.get('city')?.trim().toLowerCase();
    const matching = this.events
      .filter((e) =>
        filter === 'past'
          ? e.endsAt <= now
          : e.endsAt > now &&
            (filter !== 'hackathons' || e.type === 'Hackathon') &&
            (filter !== 'online' || e.format === 'Online'),
      )
      .filter((e) => !city || e.city.trim().toLowerCase() === city)
      .sort((a, b) =>
        filter === 'past'
          ? b.startsAt.localeCompare(a.startsAt)
          : a.startsAt.localeCompare(b.startsAt),
      )
      .map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        city: e.city,
        format: e.format,
        venue: e.venue,
        visibility: e.visibility,
        rsvpCount: e.rsvps.length,
        isCancelled: e.isCancelled,
      }));
    const cities = [...new Set(this.events.map((e) => e.city.trim()).filter((c) => c))].sort(
      (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    return route.fulfill({ status: 200, json: { events: matching, cities } });
  }
}
