import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import {
  CheckInAttendeeDto,
  CheckInDto,
  CheckInService,
  WalkInRequest,
  WalkInResultDto,
} from './check-in.service';

@Injectable()
export class HttpCheckInService implements CheckInService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  /** The page shows its own forbidden state (docs/mocks/pages/event-check-in/forbidden). */
  private readonly page = new HttpContext().set(HANDLES_FORBIDDEN, true);
  /** A failed save reverts the switch and toasts; it never leaves the page for the error page. */
  private readonly save = new HttpContext().set(HANDLES_SERVER_ERROR, true);

  getCheckIn(eventId: string): Observable<CheckInDto> {
    return this.http.get<CheckInDto>(`${this.api}/events/${eventId}/check-in`, {
      context: this.page,
    });
  }

  checkIn(eventId: string, rsvpId: string): Observable<CheckInAttendeeDto> {
    return this.http.put<CheckInAttendeeDto>(
      `${this.api}/events/${eventId}/check-ins/${rsvpId}`,
      null,
      { context: this.save },
    );
  }

  undoCheckIn(eventId: string, rsvpId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/events/${eventId}/check-ins/${rsvpId}`, {
      context: this.save,
    });
  }

  addWalkIn(eventId: string, request: WalkInRequest): Observable<WalkInResultDto> {
    return this.http.post<WalkInResultDto>(`${this.api}/events/${eventId}/walk-ins`, request, {
      context: this.save,
    });
  }
}
