import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PagedResult, ProfileRole } from '../shared';

/** A member as the people directory lists them (L2-053). There is no email: it is matched, never returned. */
export interface PersonSummary {
  /** The profile id. */
  id: string;
  name: string;
  /** The home chapter's name, or null for none and while chapters are off. */
  chapterName: string | null;
  /** The featured photo, or null when the member has none. */
  photoUrl: string | null;
  roles: ProfileRole[];
}

/**
 * Contract for the people directory (L2-053). Pages depend on PEOPLE_SERVICE, never on
 * HttpPeopleService. City Leads, Staff and System Admins only; anyone else gets 403.
 */
export interface PeopleService {
  /**
   * 25 per page by name; the term matches name or email, and a chapter's id narrows to members whose home chapter it
   * is (ignored while chapters are off, L2-142).
   */
  search(
    term: string,
    page?: number,
    chapterId?: string | null,
  ): Observable<PagedResult<PersonSummary>>;
}

export const PEOPLE_SERVICE = new InjectionToken<PeopleService>('PEOPLE_SERVICE');
