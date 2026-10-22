import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN } from '../errors';
import {
  NewPartnerRequest,
  PartnerBoardDto,
  PartnerDto,
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
}
