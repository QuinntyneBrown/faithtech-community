/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/events/event-list-and-filter
 *   - docs/detailed-designs/events/create-and-edit-events
 *   - docs/detailed-designs/events/rsvp
 *   - docs/detailed-designs/events/cancel-events
 *   - docs/detailed-designs/events/public-events-and-guest-rsvp
 *   - docs/detailed-designs/events/calendar-export
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Role } from '../shared/role';

// "Hackathon" is only an event type in v1; teams, projects and judging are v2.
export type EventType = 'Gathering' | 'BuildersNight' | 'Hackathon' | 'PrayerAndPlanning' | 'Panel';
export type EventFormat = 'InPerson' | 'Online';
export type EventVisibility = 'MembersOnly' | 'Public';

/** The event form's fields, for create and edit (L2-020). */
export interface EventRequest {
  title: string;
  description: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  city: string;
  format: EventFormat;
  venue: string | null;
  onlineLink: string | null;
  /** Null for no limit. */
  capacity: number | null;
  visibility: EventVisibility;
}

/** An event as the events list shows it (L2-021). */
export interface EventSummaryDto {
  id: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  city: string;
  format: EventFormat;
  venue: string | null;
  visibility: EventVisibility;
  rsvpCount: number;
  isCancelled: boolean;
}

/** The matching events, and every city that has an event whatever the filters. */
export interface EventListDto {
  events: EventSummaryDto[];
  cities: string[];
}

/** Someone who RSVP'd. `guestEmail` is null for members, and for Staff (L2-022 AC4). */
export interface RsvpDto {
  profileId: string | null;
  name: string;
  isGuest: boolean;
  guestEmail: string | null;
  rsvpedAt: string;
}

/** One event as its page and the edit form show it, with whether the caller may manage it. */
export interface EventDetailDto {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  city: string;
  format: EventFormat;
  venue: string | null;
  onlineLink: string | null;
  capacity: number | null;
  visibility: EventVisibility;
  rsvpCount: number;
  isFull: boolean;
  isCancelled: boolean;
  cancellationReason: string | null;
  hostName: string | null;
  /** "Event Lead", "City Lead" or "System Admin". */
  hostRole: string | null;
  callerHasRsvp: boolean;
  canManage: boolean;
  canExportRsvps: boolean;
  /** Null unless the caller is a lead, Staff or System Admin; attendees see only the count. */
  rsvps: RsvpDto[] | null;
}

/** A public event as anyone with the link sees it: no RSVP list and no joining link (L2-023). */
export interface PublicEventDto {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  city: string;
  format: EventFormat;
  venue: string | null;
  rsvpCount: number;
  isFull: boolean;
  isCancelled: boolean;
  cancellationReason: string | null;
}

export interface GuestRsvpRequest {
  name: string;
  email: string;
}

/** The list's chips (L2-021 AC2): one at a time; Hackathons and Online keep to upcoming events. */
export type EventListFilter = 'Upcoming' | 'Past' | 'Hackathons' | 'Online';

export interface EventFilter {
  filter?: EventListFilter;
  city?: string | null;
}

/**
 * Contract for the events API. Pages depend on EVENTS_SERVICE, never on HttpEventsService.
 * TODO(slice): the members-only .ics link carries no bearer token; it may need a blob fetch or signed URL.
 */
export interface EventsService {
  listEvents(filter: EventFilter): Observable<EventListDto>;
  getEvent(id: string): Observable<EventDetailDto>;
  createEvent(event: EventRequest): Observable<{ id: string }>;
  updateEvent(id: string, event: EventRequest): Observable<void>;
  cancelEvent(id: string, reason?: string | null): Observable<void>;
  /** Idempotent. 409 with a detail when the event is cancelled, started or full. */
  rsvp(id: string): Observable<void>;
  cancelRsvp(id: string): Observable<void>;
  /** The RSVP list as CSV, for leads and System Admins. */
  exportRsvps(id: string): Observable<Blob>;

  /** Anonymous. 404 for members-only and unknown events, which the page sends to sign in. */
  getPublicEvent(id: string): Observable<PublicEventDto>;
  /** Anonymous. One RSVP per email; 409 when cancelled, started or full; 429 past 10 an hour. */
  rsvpAsGuest(id: string, guest: GuestRsvpRequest): Observable<void>;
  /** Anonymous. Cancels with the token from the confirmation's cancel link; 404 for an unknown or used link. */
  cancelGuestRsvp(id: string, token: string): Observable<void>;

  /** Download url for the browser to open directly; no request is made. */
  calendarUrl(id: string, options?: { isPublic?: boolean }): string;
}

/** The event types in the form's order, with the words people read (L2-020 AC1). */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  Gathering: 'Gathering',
  BuildersNight: 'Builders night',
  Hackathon: 'Hackathon',
  PrayerAndPlanning: 'Prayer & planning',
  Panel: 'Panel',
};

const EVENT_MANAGERS: readonly Role[] = ['EventLead', 'CityLead', 'SystemAdmin'];

/** Event Leads, City Leads and System Admins create, edit and cancel events (L2-020, L2-025). */
export function canManageEvents(callerRoles: readonly Role[]): boolean {
  return callerRoles.some((r) => EVENT_MANAGERS.includes(r));
}

export const EVENTS_SERVICE = new InjectionToken<EventsService>('EVENTS_SERVICE');
