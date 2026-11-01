import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import {
  EventHubDto,
  EventHubsService,
  HubTemplateDto,
  PastEventHubDto,
  HubContentInputByKind,
  HubSectionKind,
  SaveEventHubRequest,
  StartEventHubRequest,
} from './event-hubs.service';

@Injectable()
export class HttpEventHubsService implements EventHubsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  /** The hub home shows its own forbidden, missing and failed states (docs/mocks/pages/event-hub). */
  private readonly screen = new HttpContext()
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
      context: this.screen,
    });
  }

  pastHubs(search: string, excludeEventId: string): Observable<PastEventHubDto[]> {
    return this.http.get<PastEventHubDto[]>(`${this.api}/event-hubs`, {
      params: { search, excludeEventId },
    });
  }

  templates(): Observable<HubTemplateDto[]> {
    return this.http.get<HubTemplateDto[]>(`${this.api}/event-hubs/templates`);
  }

  start(eventId: string, request: StartEventHubRequest): Observable<EventHubDto> {
    return this.http.post<EventHubDto>(`${this.api}/events/${eventId}/hub/start`, request);
  }

  page(eventId: string): Observable<EventHubDto> {
    return this.http.get<EventHubDto>(`${this.api}/events/${eventId}/hub/page`, {
      context: this.screen,
    });
  }

  save(eventId: string, request: SaveEventHubRequest): Observable<void> {
    return this.http.put<void>(`${this.api}/events/${eventId}/hub`, request, {
      context: this.wizard,
    });
  }

  saveSection<K extends HubSectionKind>(
    eventId: string,
    kind: K,
    content: HubContentInputByKind[K],
  ): Observable<void> {
    return this.http.put<void>(`${this.api}/events/${eventId}/hub/sections/${kind}`, content, {
      context: this.wizard,
    });
  }

  reorder(eventId: string, kinds: HubSectionKind[]): Observable<void> {
    return this.http.put<void>(
      `${this.api}/events/${eventId}/hub/sections/order`,
      { kinds },
      { context: this.wizard },
    );
  }

  publish(eventId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/events/${eventId}/hub/publish`, null, {
      context: this.wizard,
    });
  }

  unpublish(eventId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/events/${eventId}/hub/unpublish`, null, {
      context: this.wizard,
    });
  }
}
