/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/partners/manage-partners
 *   - docs/detailed-designs/partners/partner-kanban-board
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export const PARTNER_STAGES = ['Lead', 'InFunnel', 'Confirmed'] as const;
export type PartnerStage = (typeof PARTNER_STAGES)[number];

export interface PartnerRequest {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
}

export interface PartnerDto extends PartnerRequest {
  id: string;
  stage: PartnerStage;
  canEdit: boolean;
}

export interface PartnerCardDto {
  id: string;
  name: string;
  contactName: string;
}

export interface PartnerColumnDto {
  stage: PartnerStage;
  count: number;
  cards: PartnerCardDto[];
}

export interface PartnerBoardDto {
  columns: PartnerColumnDto[];
}

/**
 * Contract for the partners API. Pages depend on PARTNERS_SERVICE, never on HttpPartnersService.
 * TODO(slice): PartnerDto/PartnerCardDto fields are inferred; L2 adds website, owner and a move note;
 * no concurrency token exists, so moves are last-write-wins.
 */
export interface PartnersService {
  getBoard(): Observable<PartnerBoardDto>;
  get(id: string): Observable<PartnerDto>;
  create(partner: PartnerRequest): Observable<PartnerDto>;
  update(id: string, partner: PartnerRequest): Observable<PartnerDto>;
  /** Any stage to any other stage. Staff get 403. */
  move(id: string, to: PartnerStage): Observable<PartnerDto>;
}

export const PARTNERS_SERVICE = new InjectionToken<PartnersService>('PARTNERS_SERVICE');
