import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PagedResult, Role } from '../shared';

/** A member as the people directory lists them (L2-053). There is no email: it is matched, never returned. */
export interface PersonSummary {
  /** The profile id. */
  id: string;
  name: string;
  homeCity: string | null;
  /** The featured photo, or null when the member has none. */
  photoUrl: string | null;
  roles: Role[];
}

/**
 * Contract for the people directory (L2-053). Pages depend on PEOPLE_SERVICE, never on
 * HttpPeopleService. City Leads, Staff and System Admins only; anyone else gets 403.
 */
export interface PeopleService {
  /** 25 per page by name; the term matches name or email. */
  search(term: string, page?: number): Observable<PagedResult<PersonSummary>>;
}

export const PEOPLE_SERVICE = new InjectionToken<PeopleService>('PEOPLE_SERVICE');
