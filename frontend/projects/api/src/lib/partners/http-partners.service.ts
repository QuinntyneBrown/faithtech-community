import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import {
  LogPartnerActivityRequest,
  NewPartnerRequest,
  PartnerActivityDto,
  PartnerActivityFilter,
  PartnerActivityPageDto,
  PartnerBoardDto,
  PartnerDto,
  PartnerDuplicatesDto,
  PartnerOwnerDto,
  PartnerRequest,
  PartnerStage,
  PartnersService,
} from './partners.service';

@Injectable()
export class HttpPartnersService implements PartnersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/partners`;
  // The partners page shows its own forbidden state for callers who may not see the pipeline.
  private readonly context = new HttpContext().set(HANDLES_FORBIDDEN, true);
  // The duplicate check is advisory: the partner page shows without it when it fails.
  private readonly advisory = new HttpContext().set(HANDLES_SERVER_ERROR, true);

  getBoard(): Observable<PartnerBoardDto> {
    return this.http.get<PartnerBoardDto>(this.base, { context: this.context });
  }

  get(id: string): Observable<PartnerDto> {
    return this.http.get<PartnerDto>(`${this.base}/${id}`);
  }

  owners(): Observable<PartnerOwnerDto[]> {
    return this.http.get<PartnerOwnerDto[]>(`${this.base}/owners`);
  }

  create(partner: NewPartnerRequest): Observable<PartnerDto> {
    return this.http.post<PartnerDto>(this.base, partner);
  }

  update(id: string, partner: PartnerRequest): Observable<PartnerDto> {
    return this.http.put<PartnerDto>(`${this.base}/${id}`, partner);
  }

  move(id: string, to: PartnerStage, note: string | null = null): Observable<PartnerDto> {
    return this.http.post<PartnerDto>(`${this.base}/${id}/stage`, { to, note });
  }

  activities(
    id: string,
    kind: PartnerActivityFilter | null = null,
    before: string | null = null,
  ): Observable<PartnerActivityPageDto> {
    let params = new HttpParams();
    if (kind) params = params.set('kind', kind);
    if (before) params = params.set('before', before);
    return this.http.get<PartnerActivityPageDto>(`${this.base}/${id}/activities`, { params });
  }

  logActivity(id: string, activity: LogPartnerActivityRequest): Observable<PartnerActivityDto> {
    return this.http.post<PartnerActivityDto>(`${this.base}/${id}/activities`, activity);
  }

  duplicates(id: string): Observable<PartnerDuplicatesDto> {
    return this.http.get<PartnerDuplicatesDto>(`${this.base}/${id}/duplicates`, {
      context: this.advisory,
    });
  }

  dismissDuplicate(id: string, otherId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/duplicates/${otherId}/dismissal`, null);
  }
}
