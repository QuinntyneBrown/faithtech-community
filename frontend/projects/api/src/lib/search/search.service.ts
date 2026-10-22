import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type SearchResultKind = 'Person' | 'Event' | 'Partner' | 'Contact' | 'WorkItem';

export interface SearchResultItem {
  id: string;
  title: string;
  snippet: string;
  /** App route to open the result. */
  route: string;
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
 * Contract for the search API (L2-026, ADR 0017). Pages depend on SEARCH_SERVICE, never on
 * HttpSearchService. The server leaves out what the caller may not open and empty groups, and
 * returns at most 10 results per group.
 */
export interface SearchService {
  /** Terms shorter than MIN_SEARCH_LENGTH resolve to no groups without calling the API. */
  search(term: string): Observable<SearchResultsDto>;
}

export const SEARCH_SERVICE = new InjectionToken<SearchService>('SEARCH_SERVICE');
