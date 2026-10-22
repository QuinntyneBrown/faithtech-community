import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export const PARTNER_STAGES = ['Lead', 'InFunnel', 'Confirmed'] as const;
export type PartnerStage = (typeof PARTNER_STAGES)[number];

/** How each stage is written on screen. */
export const PARTNER_STAGE_LABELS: Record<PartnerStage, string> = {
  Lead: 'Lead',
  InFunnel: 'In funnel',
  Confirmed: 'Confirmed',
};

export interface PartnerRequest {
  name: string;
  website: string | null;
  offering: string | null;
  /** A member holding a lead role (GET /api/partners/owners). */
  ownerId: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export interface NewPartnerRequest extends PartnerRequest {
  /** Lead when left out. */
  stage?: PartnerStage;
}

/** One move in a partner's history (L2-018 AC2). */
export interface PartnerStageChangeDto {
  from: PartnerStage;
  to: PartnerStage;
  movedById: string;
  movedByName: string;
  movedAtUtc: string;
  note: string | null;
}

export interface PartnerDto {
  id: string;
  name: string;
  website: string | null;
  offering: string | null;
  ownerId: string | null;
  ownerName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  stage: PartnerStage;
  /** Newest first. */
  history: PartnerStageChangeDto[];
  /** False for Staff, who see the pipeline read-only. */
  canEdit: boolean;
}

export interface PartnerCardDto {
  id: string;
  name: string;
  contactName: string | null;
  offering: string | null;
}

export interface PartnerColumnDto {
  stage: PartnerStage;
  count: number;
  cards: PartnerCardDto[];
}

/** The three stages in order (L2-018 AC1). */
export interface PartnerBoardDto {
  columns: PartnerColumnDto[];
  canEdit: boolean;
}

export interface PartnerOwnerDto {
  profileId: string;
  name: string;
}

/**
 * Contract for the shared partner pipeline (L2-017, L2-018, ADR 0014). Pages depend on
 * PARTNERS_SERVICE, never on HttpPartnersService. Lead roles, Staff and System Admin read; Staff
 * get 403 for writes and everyone else 403 for everything.
 */
export interface PartnersService {
  getBoard(): Observable<PartnerBoardDto>;
  get(id: string): Observable<PartnerDto>;
  /** Members who may own a partner. */
  owners(): Observable<PartnerOwnerDto[]>;
  create(partner: NewPartnerRequest): Observable<PartnerDto>;
  update(id: string, partner: PartnerRequest): Observable<PartnerDto>;
  /** Any stage to any other; the move is recorded with the optional note. 409 for the current stage. */
  move(id: string, to: PartnerStage, note?: string | null): Observable<PartnerDto>;
}

export const PARTNERS_SERVICE = new InjectionToken<PartnersService>('PARTNERS_SERVICE');
