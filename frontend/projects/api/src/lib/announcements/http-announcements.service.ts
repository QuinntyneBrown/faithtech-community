import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../config';
import { PagedResult, toHttpParams } from '../shared';
import {
  AnnouncementAudience,
  AnnouncementDto,
  AnnouncementSent,
  AnnouncementsService,
  SendAnnouncementRequest,
} from './announcements.service';

@Injectable()
export class HttpAnnouncementsService implements AnnouncementsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  list(page = 1): Observable<PagedResult<AnnouncementDto>> {
    return this.http.get<PagedResult<AnnouncementDto>>(`${this.api}/announcements`, {
      params: toHttpParams({ page }),
    });
  }

  countRecipients(audience: AnnouncementAudience): Observable<number> {
    return this.http
      .post<{ count: number }>(`${this.api}/announcements/recipient-count`, audience)
      .pipe(map((r) => r.count));
  }

  send(announcement: SendAnnouncementRequest): Observable<AnnouncementSent> {
    return this.http.post<AnnouncementSent>(`${this.api}/announcements`, announcement);
  }

  setEmailOptOut(optedOut: boolean): Observable<void> {
    return this.http.put<void>(`${this.api}/me/announcement-email-opt-out`, { optedOut });
  }

  unsubscribe(token: string): Observable<void> {
    return this.http.post<void>(`${this.api}/announcements/unsubscribe`, { token });
  }
}
