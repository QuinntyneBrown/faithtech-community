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

// "Hackathon" is only an event type in v1; teams, projects and judging are v2.
export type EventType = 'Standard' | 'Hackathon';
export type EventFormat = 'InPerson' | 'Online';
export type EventVisibility = 'MembersOnly' | 'Public';

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
  visibility: EventVisibility;
}

export interface EventSummaryDto {
  id: string;
  title: string;
  startsAt: string;
  city: string;
  format: EventFormat;
  rsvpCount: number;
  isCancelled: boolean;
}

export interface RsvpDto {
  name: string;
  /** Null for Staff. */
  guestEmail: string | null;
  isGuest: boolean;
}

export interface EventDetailDto {
  id: string;
  title: string;
  rsvpCount: number;
  callerHasRsvp: boolean;
  /** Null for attendees; the full list is for leads. */
  rsvps: RsvpDto[] | null;
}

export interface PublicEventDto {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venue: string | null;
  onlineLink: string | null;
  isCancelled: boolean;
}

export interface GuestRsvpRequest {
  name: string;
  email: string;
}

export interface EventFilter {
  city?: string;
}

/**
 * Contract for the events API. Pages depend on EVENTS_SERVICE, never on HttpEventsService.
 * TODO(slice): the designs' DTOs are thin (EventDetailDto lacks description, dates, venue); L2 adds capacity,
 * upcoming/past/hackathon/online filters, richer event types, RSVP CSV export and guest cancel links.
 * TODO(slice): the members-only .ics link carries no bearer token; it may need a blob fetch or signed URL.
 */
export interface EventsService {
  listEvents(filter: EventFilter): Observable<EventSummaryDto[]>;
  getEvent(id: string): Observable<EventDetailDto>;
  createEvent(event: EventRequest): Observable<{ id: string }>;
  updateEvent(id: string, event: EventRequest): Observable<void>;
  cancelEvent(id: string, reason?: string | null): Observable<void>;
  /** Idempotent. 409 when the event is cancelled. */
  rsvp(id: string): Observable<void>;
  cancelRsvp(id: string): Observable<void>;

  /** Anonymous. 404 for members-only events. */
  getPublicEvent(id: string): Observable<PublicEventDto>;
  /** Anonymous. Rate limited (429). */
  rsvpAsGuest(id: string, guest: GuestRsvpRequest): Observable<void>;

  /** Download url for the browser to open directly; no request is made. */
  calendarUrl(id: string, options?: { isPublic?: boolean }): string;
}

export const EVENTS_SERVICE = new InjectionToken<EventsService>('EVENTS_SERVICE');
