/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/search/global-search
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the search API. Pages depend on SEARCH_SERVICE, never on HttpSearchService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface SearchService {}

export const SEARCH_SERVICE = new InjectionToken<SearchService>('SEARCH_SERVICE');
