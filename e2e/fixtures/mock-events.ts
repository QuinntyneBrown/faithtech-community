import { Route } from '@playwright/test';

/** An RSVP as the Rsvps table holds it: a member's profile id, or a guest's name and email. */
export interface MockRsvp {
  id: string;
  profileId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  createdAt: string;
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
}

const LIST_FILTERS = ['upcoming', 'past', 'hackathons', 'online'];

/**
 * Plays the events endpoints (backend/src/FaithTech.Community.Api/Endpoints/EventsEndpoints.cs)
 * over an in-memory list of events, with the same filters and permission rules.
 */
export class MockEvents {
  readonly events: MockEvent[] = [];

  constructor(private readonly now: () => Date) {}

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
    caller: EventsCaller | null,
  ): Promise<void> | false {
    if (method === 'GET' && url.pathname === '/api/events') return this.list(route, url, caller);
    return false;
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
