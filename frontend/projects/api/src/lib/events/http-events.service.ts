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
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { toHttpParams } from '../shared';
import {
  EventDetailDto,
  EventFilter,
  EventListDto,
  EventRequest,
  EventsService,
  GuestRsvpRequest,
  PublicEventDto,
} from './events.service';

@Injectable()
export class HttpEventsService implements EventsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  listEvents(filter: EventFilter): Observable<EventListDto> {
    return this.http.get<EventListDto>(`${this.api}/events`, {
      params: toHttpParams({ filter: filter.filter, city: filter.city }),
    });
  }

  getEvent(id: string): Observable<EventDetailDto> {
    return this.http.get<EventDetailDto>(`${this.api}/events/${id}`);
  }

  createEvent(event: EventRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.api}/events`, event);
  }

  updateEvent(id: string, event: EventRequest): Observable<void> {
    return this.http.put<void>(`${this.api}/events/${id}`, event);
  }

  cancelEvent(id: string, reason: string | null = null): Observable<void> {
    return this.http.post<void>(`${this.api}/events/${id}/cancel`, { reason });
  }

  rsvp(id: string): Observable<void> {
    return this.http.post<void>(`${this.api}/events/${id}/rsvps`, null);
  }

  cancelRsvp(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/events/${id}/rsvps/me`);
  }

  exportRsvps(id: string): Observable<Blob> {
    return this.http.get(`${this.api}/events/${id}/rsvps.csv`, { responseType: 'blob' });
  }

  getPublicEvent(id: string): Observable<PublicEventDto> {
    return this.http.get<PublicEventDto>(`${this.api}/public/events/${id}`);
  }

  rsvpAsGuest(id: string, guest: GuestRsvpRequest): Observable<void> {
    return this.http.post<void>(`${this.api}/public/events/${id}/rsvps`, guest);
  }

  cancelGuestRsvp(id: string, token: string): Observable<void> {
    return this.http.post<void>(`${this.api}/public/events/${id}/rsvps/cancel`, { token });
  }

  calendarUrl(id: string, options: { isPublic?: boolean } = {}): string {
    return `${this.api}/${options.isPublic ? 'public/' : ''}events/${id}/calendar.ics`;
  }
}
