/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/search/global-search
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';

import { API_BASE_URL } from '../config';
import { toHttpParams } from '../shared';
import { MIN_SEARCH_LENGTH, SearchResultsDto, SearchService } from './search.service';

@Injectable()
export class HttpSearchService implements SearchService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  search(term: string): Observable<SearchResultsDto> {
    const q = term.trim();
    if (q.length < MIN_SEARCH_LENGTH) {
      return of({ groups: [] });
    }
    return this.http.get<SearchResultsDto>(`${this.base}/search`, { params: toHttpParams({ q }) });
  }
}
