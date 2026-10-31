import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Capability, hasAny } from '../shared/capability';

// "Hackathon" is only an event type in v1; teams, projects and judging are v2.
export type EventType = 'Gathering' | 'BuildersNight' | 'Hackathon' | 'PrayerAndPlanning' | 'Panel';
export type EventFormat = 'InPerson' | 'Online';
export type EventVisibility = 'MembersOnly' | 'Public';

/** The event form's fields, for create and edit (L2-020). No chapter means organisation-wide (L2-141 AC2). */
export interface EventRequest {
  title: string;
  description: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  chapterId: string | null;
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
  chapterId: string | null;
  /** Null for an organisation-wide event, and while chapters are off. */
  chapterName: string | null;
  format: EventFormat;
  venue: string | null;
  visibility: EventVisibility;
  rsvpCount: number;
  isCancelled: boolean;
}

/** The matching events, and every chapter name that has an event whatever the filters. */
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
  /** When they were checked in at the door, if they were (L2-121). */
  checkedInAt: string | null;
}

/** One event as its page and the edit form show it, with whether the caller may manage it. */
export interface EventDetailDto {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  chapterId: string | null;
  chapterName: string | null;
  format: EventFormat;
  venue: string | null;
  onlineLink: string | null;
  capacity: number | null;
  visibility: EventVisibility;
  rsvpCount: number;
  isFull: boolean;
  isCancelled: boolean;
  cancellationReason: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  hostName: string | null;
  /** "Event Lead", "City Lead" or "System Admin". */
  hostRole: string | null;
  callerHasRsvp: boolean;
  canManage: boolean;
  canExportRsvps: boolean;
  /** Null unless the caller is a lead, Staff or System Admin; attendees see only the count. */
  rsvps: RsvpDto[] | null;
  /** Everyone checked in, walk-ins included; null for callers who don't see the RSVP list (L2-121). */
  checkedInCount: number | null;
  /** Lead roles and System Admins check people in; Staff only view the check-in page (L2-117). */
  canCheckIn: boolean;
  canViewCheckIn: boolean;
}

/** A public event as anyone with the link sees it: no RSVP list and no joining link (L2-023). */
export interface PublicEventDto {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  chapterName: string | null;
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
 */
export interface EventsService {
  listEvents(filter: EventFilter): Observable<EventListDto>;
  getEvent(id: string): Observable<EventDetailDto>;
  createEvent(event: EventRequest): Observable<{ id: string }>;
  updateEvent(id: string, event: EventRequest): Observable<void>;
  /** Event managers; the reason is required (L2-025). 409 when already cancelled. */
  cancelEvent(id: string, reason: string): Observable<void>;
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

  /** The event's .ics for a signed-in member, fetched with their token (L2-024). */
  downloadCalendar(id: string): Observable<Blob>;
  /** Download url of a public event's .ics for the browser to open directly; no request is made. */
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

/** ManageEvents creates, edits and cancels events (L2-020, L2-025, L2-135 AC7). */
export function canManageEvents(capabilities: readonly Capability[]): boolean {
  return hasAny(capabilities, 'ManageEvents');
}

export const EVENTS_SERVICE = new InjectionToken<EventsService>('EVENTS_SERVICE');
