import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Role } from '../shared';

export type InviteStatus = 'Pending' | 'Accepted' | 'Expired' | 'Revoked';

export interface InviteDto {
  id: string;
  email: string;
  preassignedRole: Role | null;
  status: InviteStatus;
  invitedByName: string;
  createdAt: string;
  /** Invites expire 14 days after they are sent. */
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface SendInviteRequest {
  email: string;
  preassignedRole?: Role | null;
  /** Optional personal note, up to 500 characters. */
  note?: string | null;
}

/** What the invite link shows before anyone signs in (ADR 0006). */
export interface InviteLookupDto {
  status: InviteStatus;
  email: string;
  inviterName: string;
  inviterCity: string | null;
  preassignedRole: Role | null;
  /** An account already uses the invited email, so the invitee signs in to accept. */
  hasAccount: boolean;
}

export interface NewAccount {
  name: string;
  password: string;
}

/** Contract for the invites API (L2-010, L2-011). Pages depend on INVITES_SERVICE, never on HttpInvitesService. */
export interface InvitesService {
  /** Leads and System Admins. 400 Email, 403 with a detail (role or unverified), 429 over 50 a day. */
  sendInvite(request: SendInviteRequest): Observable<InviteDto>;
  /** Every lead's invites, newest first. */
  listInvites(): Observable<InviteDto[]>;
  /** An expired invite only: sends a new one with a new 14-day link. */
  resendInvite(id: string): Observable<InviteDto>;
  /** A pending invite only. */
  revokeInvite(id: string): Observable<void>;
  /** Anonymous. 404 when the token matches no invite. */
  getInvite(token: string): Observable<InviteLookupDto>;
  /** Anonymous with a new account; without one the caller must be signed in with the invited email. */
  acceptInvite(token: string, account?: NewAccount): Observable<void>;
}

export const INVITES_SERVICE = new InjectionToken<InvitesService>('INVITES_SERVICE');
