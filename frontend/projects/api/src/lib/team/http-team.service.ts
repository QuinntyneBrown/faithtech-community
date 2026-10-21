/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/team/team-list
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { Role, toHttpParams } from '../shared';
import { TeamMemberDto, TeamService } from './team.service';

@Injectable()
export class HttpTeamService implements TeamService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  list(role?: Role): Observable<TeamMemberDto[]> {
    return this.http.get<TeamMemberDto[]>(`${this.base}/team`, { params: toHttpParams({ role }) });
  }
}
