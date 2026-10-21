/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/invites/send-invite
 *   - docs/detailed-designs/invites/accept-invite
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Role } from '../shared';

export type InviteStatus = 'Pending' | 'Accepted' | 'Expired' | 'Revoked';

export interface InviteDto {
  id: string;
  email: string;
  preassignedRole: Role | null;
  status: InviteStatus;
  createdAt: string;
  /** Invites expire 14 days after they are sent. */
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface InviteLookupDto {
  email: string;
  status: InviteStatus;
}

export interface NewAccount {
  name: string;
  password: string;
}

/**
 * Contract for the invites API. Pages depend on INVITES_SERVICE, never on HttpInvitesService.
 * TODO(slice): InviteDto and InviteLookupDto are inferred; L2 adds a personal note and resend, neither designed;
 * how the token is passed to by-token and the invalid-invite response are unspecified.
 */
export interface InvitesService {
  sendInvite(email: string, preassignedRole?: Role | null): Observable<InviteDto>;
  listInvites(): Observable<InviteDto[]>;
  revokeInvite(id: string): Observable<void>;
  /** Anonymous. */
  getInvite(token: string): Observable<InviteLookupDto>;
  /** Anonymous with a new account; with no account the caller must be signed in. */
  acceptInvite(token: string, account?: NewAccount): Observable<void>;
}

export const INVITES_SERVICE = new InjectionToken<InvitesService>('INVITES_SERVICE');
