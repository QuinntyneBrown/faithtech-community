import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** A partner stage's key: the organisation defines its stages (L2-144); names come from the DTOs. */
export type PartnerStage = string;

/** Whether partners on a stage count as confirmed on Home and in Reports (L2-144 AC5). */
export type PartnerStageKind = 'Open' | 'Confirmed';

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
  /** A stage key; the initial stage when left out (L2-144 AC3). */
  stage?: PartnerStage;
}

export const LOGGED_ACTIVITY_KINDS = ['Call', 'Email', 'Meeting', 'Note'] as const;
/** The kinds a lead logs. */
export type LoggedActivityKind = (typeof LOGGED_ACTIVITY_KINDS)[number];

export const PARTNER_ACTIVITY_KINDS = [
  ...LOGGED_ACTIVITY_KINDS,
  'Added',
  'StageMoved',
  'Merged',
  'Restored',
] as const;
/** Logged kinds plus the entries the system writes when a partner is added, moved, merged or restored. */
export type PartnerActivityKind = (typeof PARTNER_ACTIVITY_KINDS)[number];

/** How each kind is named on the timeline. */
export const PARTNER_ACTIVITY_LABELS: Record<PartnerActivityKind, string> = {
  Call: 'Call',
  Email: 'Email',
  Meeting: 'Meeting',
  Note: 'Note',
  Added: 'Added to the pipeline',
  StageMoved: 'Stage moved',
  Merged: 'Merged',
  Restored: 'Restored',
};

/** One entry on a partner's shared timeline (L2-111). */
export interface PartnerActivityDto {
  id: string;
  kind: PartnerActivityKind;
  /** What was logged; the move note on a Stage moved entry. */
  summary: string | null;
  /** The sentence the timeline shows. */
  text: string;
  /** yyyy-MM-dd. */
  occurredOn: string;
  /** HH:mm:ss, or null when no time was given. */
  occurredAt: string | null;
  nextStep: string | null;
  nextStepDue: string | null;
  loggedById: string;
  loggedByName: string;
  loggedAtUtc: string;
  fromStage: PartnerStage | null;
  toStage: PartnerStage | null;
  /** The other partner of a Merged or Restored entry. */
  relatedPartnerId: string | null;
  relatedPartnerName: string | null;
  /** The partner a merge moved this entry from, shown as "from {name}". */
  mergedFromPartnerId: string | null;
  mergedFromPartnerName: string | null;
}

/** The timeline's type chips: one logged kind, or Stage for Added, Stage moved, Merged and Restored. */
export type PartnerActivityFilter = LoggedActivityKind | 'Stage';

/** Newest first; `before` asks for the next, older page and is null on the last one. */
export interface PartnerActivityPageDto {
  items: PartnerActivityDto[];
  before: string | null;
}

export interface LogPartnerActivityRequest {
  kind: LoggedActivityKind;
  summary: string;
  /** yyyy-MM-dd, not after today. */
  occurredOn: string;
  /** HH:mm, optional. */
  occurredAt: string | null;
  nextStep: string | null;
  /** Only with a next step. */
  nextStepDue: string | null;
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
  /** The stage's key. */
  stage: PartnerStage;
  /** The stage's current name, with "(archived)" once archived (L2-144 AC6). */
  stageName: string;
  stageKind: PartnerStageKind;
  /** False for Staff, who see the pipeline read-only. */
  canEdit: boolean;
  /** yyyy-MM-dd of the latest timeline entry (L2-111 AC7). */
  lastActivityOn: string | null;
  /** The latest logged activity's next step, with its due date (L2-111 AC6). */
  nextStep: string | null;
  nextStepDue: string | null;
  /** False for Staff and on an archived partner. */
  canLogActivity: boolean;
  /** Moved on by every edit, move, merge and restore; a merge sends the version the lead saw. */
  version: number;
  /** Set when a merge archived this partner (L2-114 AC7). */
  archived: PartnerArchivedDto | null;
  /** System Admin on an archived partner (L2-115 AC5). */
  canRestore: boolean;
}

/** Who merged an archived partner, when and into which partner. */
export interface PartnerArchivedDto {
  mergedIntoId: string;
  mergedIntoName: string;
  /** The kept partner's version, which a restore sends. */
  mergedIntoVersion: number;
  mergedById: string;
  mergedByName: string;
  mergedAtUtc: string;
}

/** The fields a merge chooses between, in the dialog's order, with their labels (L2-114 AC1). */
export const MERGE_FIELDS = [
  { field: 'name', label: 'Name' },
  { field: 'stage', label: 'Stage' },
  { field: 'contactName', label: 'Main contact' },
  { field: 'email', label: 'Email' },
  { field: 'phone', label: 'Phone' },
  { field: 'website', label: 'Website' },
  { field: 'offering', label: 'Offering' },
  { field: 'owner', label: 'Owner' },
] as const;
export type MergeField = (typeof MERGE_FIELDS)[number]['field'];
/** "keep" takes the kept record's value, "other" the other record's. */
export type MergeChoice = 'keep' | 'other';

/** POST /api/partners/{id}/restore: the archived partner's and the kept partner's versions as loaded. */
export interface RestorePartnerRequest {
  version: number;
  mergedIntoVersion: number;
}

/** POST /api/partners/{keepId}/merge: the versions the lead saw and a choice per differing field. */
export interface MergePartnersRequest {
  otherId: string;
  keepVersion: number;
  otherVersion: number;
  choices: Partial<Record<MergeField, MergeChoice>>;
}

/** Why two partners may be the same: equal website hosts, else equal names (ADR 0027). */
export type DuplicateReason = 'Website' | 'Name';

/** A possible duplicate of the partner (L2-113). */
export interface PartnerDuplicateDto {
  id: string;
  name: string;
  reason: DuplicateReason;
  /** The shared host for Website; the other partner's name as written for Name. */
  matchedOn: string;
  /** Who added the other partner and when (yyyy-MM-dd); null when it has no Added entry. */
  addedByName: string | null;
  addedOn: string | null;
}

/** Undismissed matches, by name; the first takes the partner page's alert. */
export interface PartnerDuplicatesDto {
  matches: PartnerDuplicateDto[];
}

export interface PartnerCardDto {
  id: string;
  name: string;
  contactName: string | null;
  offering: string | null;
  nextStep: string | null;
  nextStepDue: string | null;
}

/** One column per active stage, then one per archived stage that still holds partners (L2-144 AC3, AC4). */
export interface PartnerColumnDto {
  /** The stage's key. */
  stage: PartnerStage;
  count: number;
  cards: PartnerCardDto[];
  stageId: string;
  name: string;
  kind: PartnerStageKind;
  /** An archived stage's column: "Archived stage: {name}", with no drop target. */
  archived: boolean;
}

/** The organisation's stages in order (L2-018 AC1, L2-144 AC3). */
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
  /** The shared timeline, newest first, 50 at a time; `before` is the previous page's cursor (L2-111). */
  activities(
    id: string,
    kind?: PartnerActivityFilter | null,
    before?: string | null,
  ): Observable<PartnerActivityPageDto>;
  /** Logs a call, email, meeting or note (L2-110). 400 keyed by field, 403 for Staff. */
  logActivity(id: string, activity: LogPartnerActivityRequest): Observable<PartnerActivityDto>;
  /** Possible duplicates of the partner (L2-113); empty for an archived partner. */
  duplicates(id: string): Observable<PartnerDuplicatesDto>;
  /** "Not the same": stored once for the pair, for every lead. 403 for Staff. */
  dismissDuplicate(id: string, otherId: string): Observable<void>;
  /**
   * Keeps `keepId`, archives the other and moves both timelines into the kept partner (L2-114).
   * 409 when either changed since the lead compared them; 403 for Staff.
   */
  merge(keepId: string, request: MergePartnersRequest): Observable<PartnerDto>;
  /**
   * Makes a merged partner active again and moves its own entries back (L2-115). System Admin
   * only (403 for everyone else); 409 when either partner changed since the page loaded.
   */
  restore(id: string, request: RestorePartnerRequest): Observable<PartnerDto>;
}

export const PARTNERS_SERVICE = new InjectionToken<PartnersService>('PARTNERS_SERVICE');
