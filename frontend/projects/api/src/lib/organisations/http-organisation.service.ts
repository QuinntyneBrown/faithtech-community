import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';

import { API_BASE_URL } from '../config';
import { OrganisationDto, OrganisationService } from './organisation.service';

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
}
