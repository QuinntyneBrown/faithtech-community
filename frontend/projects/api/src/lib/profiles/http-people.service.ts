import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN } from '../errors';
import { PagedResult, toHttpParams } from '../shared';
import { PeopleService, PersonSummary } from './people.service';

@Injectable()
export class HttpPeopleService implements PeopleService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/people`;
  // The people page shows its own forbidden state.
  private readonly context = new HttpContext().set(HANDLES_FORBIDDEN, true);

  search(term: string, page = 1): Observable<PagedResult<PersonSummary>> {
    return this.http.get<PagedResult<PersonSummary>>(this.base, {
      params: toHttpParams({ q: term, page }),
      context: this.context,
    });
  }
}
