/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/team/team-list
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Role } from '../shared';

export interface TeamMemberDto {
  profileId: string;
  name: string;
  photoUrl: string;
  roles: Role[];
}

/**
 * Contract for the team API. Pages depend on TEAM_SERVICE, never on HttpTeamService.
 * TODO(slice): L2-019 also wants a Leads/Volunteers group filter and a city filter; sort and paging are open.
 */
export interface TeamService {
  list(role?: Role): Observable<TeamMemberDto[]>;
}

export const TEAM_SERVICE = new InjectionToken<TeamService>('TEAM_SERVICE');
