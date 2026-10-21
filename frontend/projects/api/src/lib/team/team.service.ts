import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Role } from '../shared';

/** Leads are City, Event, Create and Communications Lead; Volunteers hold the Volunteer role (ADR 0007). */
export type TeamRoleFilter = 'Leads' | 'Volunteers';

export interface TeamFilters {
  role?: TeamRoleFilter | null;
  /** A home city; matched ignoring case. */
  city?: string | null;
}

export interface TeamMemberDto {
  profileId: string;
  name: string;
  homeCity: string | null;
  /** The featured photo, or null when the member has none. */
  photoUrl: string | null;
  /** Every role the member holds, not only the team roles. */
  roles: Role[];
}

/** Members sorted by name, and every team member's home city whatever the filters. */
export interface TeamListDto {
  members: TeamMemberDto[];
  cities: string[];
}

/** Contract for the team API (L2-019). Pages depend on TEAM_SERVICE, never on HttpTeamService. */
export interface TeamService {
  list(filters?: TeamFilters): Observable<TeamListDto>;
}

export const TEAM_SERVICE = new InjectionToken<TeamService>('TEAM_SERVICE');
