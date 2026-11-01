import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import { EventHubDto, EventHubsService, SaveEventHubRequest } from './event-hubs.service';

@Injectable()
export class HttpEventHubsService implements EventHubsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  /** The hub home shows its own forbidden, missing and failed states (docs/mocks/pages/event-hub). */
  private readonly page = new HttpContext()
    .set(HANDLES_FORBIDDEN, true)
    .set(HANDLES_SERVER_ERROR, true);
  /** The wizard keeps what was entered and offers Try again (docs/mocks/dialogs/create-event-hub/failed). */
  private readonly wizard = new HttpContext().set(HANDLES_SERVER_ERROR, true);

  create(eventId: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.api}/events/${eventId}/hub`, null, {
      context: this.wizard,
    });
  }

  get(eventId: string): Observable<EventHubDto> {
    return this.http.get<EventHubDto>(`${this.api}/events/${eventId}/hub`, {
      context: this.page,
    });
  }

  save(eventId: string, request: SaveEventHubRequest): Observable<void> {
    return this.http.put<void>(`${this.api}/events/${eventId}/hub`, request, {
      context: this.wizard,
    });
  }
}
