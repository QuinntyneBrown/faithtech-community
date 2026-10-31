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

/** GET /api/organisation. Chapters and the taxonomies join it in their slices (organisation-settings design). */
export interface OrganisationDto {
  name: string;
  shortName: string;
  chapterLabel: ChapterLabel | null;
  /** The roles not archived, in the organisation's order. */
  roles: OrganisationRole[];
}

/** PUT /api/organisation: the General settings (L2-147). */
export interface UpdateOrganisationRequest {
  name: string;
  shortName: string;
}

/**
 * Contract for the host organisation's settings. Pages depend on ORGANISATION_SERVICE, never on
 * HttpOrganisationService. `get` is read once and cached for the session; `update` answers 400 with field
 * errors, or 403 to a caller without ManageOrganisationSettings, and the next `get` reads afresh.
 */
export interface OrganisationService {
  get(): Observable<OrganisationDto>;
  update(settings: UpdateOrganisationRequest): Observable<void>;
}

export const ORGANISATION_SERVICE = new InjectionToken<OrganisationService>('ORGANISATION_SERVICE');
