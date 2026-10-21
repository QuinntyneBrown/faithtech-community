/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/announcements/send-announcement
 *   - docs/detailed-designs/announcements/read-announcements-and-opt-out
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PagedResult, Role } from '../shared';

export type AudienceKind = 'Everyone' | 'Role' | 'EventRsvps';

export interface AnnouncementAudience {
  kind: AudienceKind;
  role: Role | null;
  eventId: string | null;
}

export interface SendAnnouncementRequest {
  subject: string;
  body: string;
  audience: AnnouncementAudience;
}

export interface AnnouncementDto {
  id: string;
  subject: string;
  body: string;
  sentAt: string;
}

/**
 * Contract for the announcements API. Pages depend on ANNOUNCEMENTS_SERVICE, never on HttpAnnouncementsService.
 * TODO(slice): the design takes one role (L2-029 says several) and has no "also send by email" flag;
 * AnnouncementPage is undefined so PagedResult is assumed; there is no endpoint to read the current opt-out.
 */
export interface AnnouncementsService {
  list(page?: number): Observable<PagedResult<AnnouncementDto>>;
  countRecipients(audience: AnnouncementAudience): Observable<number>;
  send(announcement: SendAnnouncementRequest): Observable<{ id: string }>;
  setEmailOptOut(optedOut: boolean): Observable<void>;
  /** Anonymous: opens from the email footer link with a signed token. */
  unsubscribe(token: string): Observable<void>;
}

export const ANNOUNCEMENTS_SERVICE = new InjectionToken<AnnouncementsService>(
  'ANNOUNCEMENTS_SERVICE',
);
