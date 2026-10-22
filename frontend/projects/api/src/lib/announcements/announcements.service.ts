import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PagedResult, Role } from '../shared';

/** Event RSVP lists are refused until events store RSVPs (ADR 0016). */
export type AudienceKind = 'Everyone' | 'Roles' | 'EventRsvps';

export interface AnnouncementAudience {
  kind: AudienceKind;
  /** One or more roles when `kind` is `Roles`. */
  roles?: Role[];
}

export interface SendAnnouncementRequest {
  subject: string;
  body: string;
  audience: AnnouncementAudience;
  /** "Also send by email"; recipients who opted out still get only the in-app notification. */
  alsoEmail: boolean;
}

export interface AnnouncementSent {
  id: string;
  recipientCount: number;
  /** How many recipients also get it by email. */
  emailCount: number;
}

export interface AnnouncementDto {
  id: string;
  subject: string;
  body: string;
  sentAt: string;
  senderName: string;
  audience: { kind: AudienceKind; roles: Role[] };
  recipientCount: number;
}

/**
 * Announcements (L2-029, L2-030). Pages depend on ANNOUNCEMENTS_SERVICE, never on
 * HttpAnnouncementsService. Only Communications Leads and System Admins may count or send.
 */
export interface AnnouncementsService {
  /** What the caller received or sent, newest first, 20 to a page. */
  list(page?: number): Observable<PagedResult<AnnouncementDto>>;
  countRecipients(audience: AnnouncementAudience): Observable<number>;
  send(announcement: SendAnnouncementRequest): Observable<AnnouncementSent>;
  emailOptOut(): Observable<boolean>;
  setEmailOptOut(optedOut: boolean): Observable<void>;
  /** Anonymous: opens from the email footer link with a signed token. */
  unsubscribe(token: string): Observable<void>;
}

export const ANNOUNCEMENTS_SERVICE = new InjectionToken<AnnouncementsService>(
  'ANNOUNCEMENTS_SERVICE',
);
