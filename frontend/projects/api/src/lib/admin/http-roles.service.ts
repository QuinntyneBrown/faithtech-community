import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN } from '../errors';
import { Role } from '../shared';
import { RolesService } from './roles.service';

@Injectable()
export class HttpRolesService implements RolesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/profiles`;
  // The role dialog shows a refusal itself rather than leaving for the forbidden page.
  private readonly context = new HttpContext().set(HANDLES_FORBIDDEN, true);

  addRole(profileId: string, role: Role): Observable<Role[]> {
    return this.http.post<Role[]>(
      `${this.base}/${encodeURIComponent(profileId)}/roles`,
      { role },
      { context: this.context },
    );
  }

  removeRole(profileId: string, role: Role): Observable<Role[]> {
    return this.http.delete<Role[]>(`${this.base}/${encodeURIComponent(profileId)}/roles/${role}`, {
      context: this.context,
    });
  }
}
