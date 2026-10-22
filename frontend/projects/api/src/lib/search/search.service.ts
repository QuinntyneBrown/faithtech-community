import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** The result groups, in the order the API returns them (L2-026 AC1). */
export type SearchResultKind = 'Person' | 'Event' | 'Partner' | 'Contact' | 'WorkItem' | 'Resource';

export interface SearchResultItem {
  id: string;
  title: string;
  snippet: string;
  /** App route to open the result. */
  route: string;
  /** When an event starts. */
  startsAt: string | null;
  /** "Private" for a contact, the stage for a partner, "Public" or "Cancelled" for an event. */
  badge: string | null;
}

export interface SearchResultGroup {
  kind: SearchResultKind;
  items: SearchResultItem[];
}

export interface SearchResultsDto {
  groups: SearchResultGroup[];
}

export const MIN_SEARCH_LENGTH = 2;

/**
 * Contract for the search API. Pages depend on SEARCH_SERVICE, never on HttpSearchService.
 * The server leaves out whatever the caller may not open and returns at most 10 results a group (ADR 0016).
 */
export interface SearchService {
  /** Terms shorter than MIN_SEARCH_LENGTH resolve to no groups without calling the API. */
  search(term: string): Observable<SearchResultsDto>;
}

export const SEARCH_SERVICE = new InjectionToken<SearchService>('SEARCH_SERVICE');
