/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/search/global-search
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

// "WorkItem" belongs to the agile area, which is not a v1 feature; kept because the design lists it.
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
 * Contract for the search API. Pages depend on SEARCH_SERVICE, never on HttpSearchService.
 * The server filters out groups the caller may not see. TODO(slice): per-group limit and paging are open.
 */
export interface SearchService {
  /** Terms shorter than MIN_SEARCH_LENGTH resolve to no groups without calling the API. */
  search(term: string): Observable<SearchResultsDto>;
}

export const SEARCH_SERVICE = new InjectionToken<SearchService>('SEARCH_SERVICE');
