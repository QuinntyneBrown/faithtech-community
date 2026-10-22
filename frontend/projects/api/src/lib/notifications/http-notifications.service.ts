import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, map, tap } from 'rxjs';

import { API_BASE_URL } from '../config';
import { toHttpParams } from '../shared';
import { NotificationPage, NotificationsService } from './notifications.service';

@Injectable()
export class HttpNotificationsService implements NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/notifications`;
  private readonly changes = new Subject<void>();

  readonly readChanged: Observable<void> = this.changes.asObservable();

  list(page = 1, unreadOnly = false): Observable<NotificationPage> {
    return this.http.get<NotificationPage>(this.base, {
      params: toHttpParams({ page, unreadOnly: unreadOnly || null }),
    });
  }

  unreadCount(): Observable<number> {
    return this.http.get<{ count: number }>(`${this.base}/unread-count`).pipe(map((r) => r.count));
  }

  markRead(id: string): Observable<void> {
    return this.http
      .post<void>(`${this.base}/${id}/read`, null)
      .pipe(tap(() => this.changes.next()));
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/read-all`, null).pipe(tap(() => this.changes.next()));
  }
}
