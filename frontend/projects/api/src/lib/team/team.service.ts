import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Role } from '../shared';

/** Leads are City, Event, Create and Communications Lead; Volunteers hold the Volunteer role (ADR 0007). */
export type TeamRoleFilter = 'Leads' | 'Volunteers';

export interface TeamFilters {
  role?: TeamRoleFilter | null;
  /** A home chapter's id; ignored while chapters are off (L2-142 AC3). */
  chapterId?: string | null;
}

export interface TeamMemberDto {
  profileId: string;
  name: string;
  /** The home chapter's name, or null for none and while chapters are off. */
  chapterName: string | null;
  /** The featured photo, or null when the member has none. */
  photoUrl: string | null;
  /** Every role the member holds, not only the team roles. */
  roles: Role[];
}

/** One page of the team by name (ADR 0015). The chapter filter's options come from the organisation. */
export interface TeamListDto {
  members: TeamMemberDto[];
  /** Continues the list with the same filters; null on the last page. */
  next: string | null;
  /** How many members match the filters. */
  totalCount: number;
}

/** Contract for the team API (L2-019). Pages depend on TEAM_SERVICE, never on HttpTeamService. */
export interface TeamService {
  /** 50 members a page; pass the previous page's `next`, with the same filters, to continue. */
  list(filters?: TeamFilters, after?: string | null): Observable<TeamListDto>;
}

export const TEAM_SERVICE = new InjectionToken<TeamService>('TEAM_SERVICE');
