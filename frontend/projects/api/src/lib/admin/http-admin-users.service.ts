/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/admin/admin-users-and-override
 *   - docs/detailed-designs/admin/suspend-users
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { PagedResult, toHttpParams } from '../shared';
import { AdminUserSummary, AdminUsersService } from './admin-users.service';

@Injectable()
export class HttpAdminUsersService implements AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/admin/users`;

  search(term: string, page = 1): Observable<PagedResult<AdminUserSummary>> {
    return this.http.get<PagedResult<AdminUserSummary>>(this.base, {
      params: toHttpParams({ q: term, page }),
    });
  }

  suspend(userId: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${userId}/suspension`, { reason });
  }

  reinstate(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${userId}/suspension`);
  }
}
