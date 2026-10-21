/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/partners/manage-partners
 *   - docs/detailed-designs/partners/partner-kanban-board
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import {
  PartnerBoardDto,
  PartnerDto,
  PartnerRequest,
  PartnerStage,
  PartnersService,
} from './partners.service';

@Injectable()
export class HttpPartnersService implements PartnersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/partners`;

  getBoard(): Observable<PartnerBoardDto> {
    return this.http.get<PartnerBoardDto>(this.base);
  }

  get(id: string): Observable<PartnerDto> {
    return this.http.get<PartnerDto>(`${this.base}/${id}`);
  }

  create(partner: PartnerRequest): Observable<PartnerDto> {
    return this.http.post<PartnerDto>(this.base, partner);
  }

  update(id: string, partner: PartnerRequest): Observable<PartnerDto> {
    return this.http.put<PartnerDto>(`${this.base}/${id}`, partner);
  }

  move(id: string, to: PartnerStage): Observable<PartnerDto> {
    return this.http.post<PartnerDto>(`${this.base}/${id}/stage`, { to });
  }
}
