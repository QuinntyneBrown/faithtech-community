import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN } from '../errors';
import { PagedResult, toHttpParams } from '../shared';
import { AdminUserSummary, AdminUsersService } from './admin-users.service';

@Injectable()
export class HttpAdminUsersService implements AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/admin/users`;
  // The admin pages show their own forbidden state.
  private readonly context = new HttpContext().set(HANDLES_FORBIDDEN, true);

  search(term: string, page = 1): Observable<PagedResult<AdminUserSummary>> {
    return this.http.get<PagedResult<AdminUserSummary>>(this.base, {
      params: toHttpParams({ q: term, page }),
      context: this.context,
    });
  }

  suspend(id: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.suspension(id)}`, { reason }, { context: this.context });
  }

  reinstate(id: string): Observable<void> {
    return this.http.delete<void>(this.suspension(id), { context: this.context });
  }

  private suspension(id: string): string {
    return `${this.base}/${encodeURIComponent(id)}/suspension`;
  }
}
