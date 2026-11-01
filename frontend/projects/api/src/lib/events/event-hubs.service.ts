import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { EventFormat } from './events.service';

/** The hub's section kinds, in the order a new hub lists them (docs/detailed-designs/events/create-event-hub). */
export type HubSectionKind =
  'Hero' | 'Agenda' | 'Venue' | 'People' | 'Links' | 'Giving' | 'UpcomingEvents';

export type HubSectionState = 'Ready' | 'NeedsInfo' | 'Hidden';

/** The event's facts, read from the event on every request; the hub stores none of them (L2-154 AC3). */
export interface HubEventFactsDto {
  title: string;
  startsAt: string;
  endsAt: string;
  format: EventFormat;
  venue: string | null;
  onlineLink: string | null;
  rsvpLink: string;
  isCancelled: boolean;
}

export interface HubSectionDto {
  kind: HubSectionKind;
  visible: boolean;
  state: HubSectionState;
}

/** An event's hub as its home shows it (L2-154 AC1), sections in order. */
export interface EventHubDto {
  id: string;
  eventId: string;
  status: 'Draft' | 'Published';
  templateKey: string;
  link: string;
  event: HubEventFactsDto;
  sections: HubSectionDto[];
}

/**
 * What the wizard saves on every Next and on Save and finish later (L2-153 AC5, AC7); a kind left out keeps its
 * visibility.
 */
export interface SaveEventHubRequest {
  templateKey: string;
  sections: { kind: HubSectionKind; visible: boolean }[];
}

/**
 * Contract for event hubs (docs/detailed-designs/events/create-event-hub). Pages depend on EVENT_HUBS_SERVICE, never on
 * HttpEventHubsService. Every call is 403 without ManageEventHubs and 404 for an unknown event.
 */
export interface EventHubsService {
  /** 201 with the hub's id; 409 for a second hub or a cancelled event. */
  create(eventId: string): Observable<{ id: string }>;
  /** 404 when the event has no hub. */
  get(eventId: string): Observable<EventHubDto>;
  /** 400 with field errors for an unknown starting point or section. */
  save(eventId: string, request: SaveEventHubRequest): Observable<void>;
}

export const EVENT_HUBS_SERVICE = new InjectionToken<EventHubsService>('EVENT_HUBS_SERVICE');
