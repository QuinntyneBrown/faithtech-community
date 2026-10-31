import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import type { ChapterLabel } from '../site/site.service';

/** A role the organisation defines, as every picker offers it (L2-136 AC8). */
export interface OrganisationRole {
  id: string;
  /** The stable key invites still record the pre-assigned role by. */
  key: string;
  name: string;
  description: string;
  chapterScopable: boolean;
}

/** An active chapter as every picker and filter offers it (L2-142 AC1). */
export interface ChapterOption {
  id: string;
  name: string;
}

/** A chapter as the Chapters tab lists it (L2-140 AC3). */
export interface ChapterDto {
  id: string;
  name: string;
  sortOrder: number;
  archived: boolean;
  memberCount: number;
}

/** GET /api/organisation. The taxonomies join it in their slice (organisation-settings design). */
export interface OrganisationDto {
  name: string;
  shortName: string;
  /** Null while chapters are off (L2-140 AC2). */
  chapterLabel: ChapterLabel | null;
  /** The active chapters in order; empty while chapters are off. */
  chapters: ChapterOption[];
  /** The roles not archived, in the organisation's order. */
  roles: OrganisationRole[];
}

/** PUT /api/organisation: the General settings (L2-147). */
export interface UpdateOrganisationRequest {
  name: string;
  shortName: string;
  /** Both forms turn chapters on; null turns them off and keeps every chapter (L2-140 AC1, AC6). */
  chapterLabel: ChapterLabel | null;
}

/**
 * Contract for the host organisation's settings. Pages depend on ORGANISATION_SERVICE, never on
 * HttpOrganisationService. `get` is read once and cached for the session; every write answers 400 with field
 * errors, 403 to a caller without ManageOrganisationSettings, or 409 for a chapter write while chapters are off, and
 * the next `get` reads afresh.
 */
export interface OrganisationService {
  get(): Observable<OrganisationDto>;
  update(settings: UpdateOrganisationRequest): Observable<void>;
  listChapters(archived?: boolean): Observable<ChapterDto[]>;
  addChapter(name: string): Observable<ChapterDto>;
  renameChapter(id: string, name: string): Observable<ChapterDto>;
  reorderChapters(ids: string[]): Observable<ChapterDto[]>;
  archiveChapter(id: string): Observable<ChapterDto>;
}

export const ORGANISATION_SERVICE = new InjectionToken<OrganisationService>('ORGANISATION_SERVICE');
