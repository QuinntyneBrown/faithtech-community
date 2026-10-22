import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../config';
import { toHttpParams } from '../shared';
import { NotificationPage, NotificationQuery, NotificationsService } from './notifications.service';

@Injectable()
export class HttpNotificationsService implements NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/notifications`;

  list({ page = 1, unreadOnly = false }: NotificationQuery = {}): Observable<NotificationPage> {
    return this.http.get<NotificationPage>(this.base, {
      params: toHttpParams({ page, unreadOnly: unreadOnly || null }),
    });
  }

  unreadCount(): Observable<number> {
    return this.http.get<{ count: number }>(`${this.base}/unread-count`).pipe(map((r) => r.count));
  }

  markRead(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/read`, null);
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/read-all`, null);
  }
}
