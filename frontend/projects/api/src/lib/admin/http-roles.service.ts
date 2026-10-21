/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/admin/assign-roles
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { Role } from '../shared';
import { RolesService } from './roles.service';

@Injectable()
export class HttpRolesService implements RolesService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  addRole(profileId: string, role: Role): Observable<Role[]> {
    return this.http.post<Role[]>(`${this.base}/profiles/${profileId}/roles`, { role });
  }

  removeRole(profileId: string, role: Role): Observable<Role[]> {
    return this.http.delete<Role[]>(`${this.base}/profiles/${profileId}/roles/${role}`);
  }
}
