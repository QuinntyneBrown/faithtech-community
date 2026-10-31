import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import {
  OrganisationDto,
  OrganisationService,
  UpdateOrganisationRequest,
} from './organisation.service';

@Injectable()
export class HttpOrganisationService implements OrganisationService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  // One request per session; a failed one is forgotten, so the next caller asks again.
  private cached: Observable<OrganisationDto> | null = null;

  get(): Observable<OrganisationDto> {
    this.cached ??= this.http.get<OrganisationDto>(`${this.base}/organisation`).pipe(
      catchError((error: unknown) => {
        this.cached = null;
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.cached;
  }

  update(settings: UpdateOrganisationRequest): Observable<void> {
    // A refusal or a failure reaches the dialog, which keeps the input, rather than an error page.
    const context = new HttpContext().set(HANDLES_FORBIDDEN, true).set(HANDLES_SERVER_ERROR, true);
    return this.http
      .put<void>(`${this.base}/organisation`, settings, { context })
      .pipe(tap(() => (this.cached = null)));
  }
}
