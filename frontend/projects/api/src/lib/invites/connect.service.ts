import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** The caller's connect link, as "My QR code" shows it (ADR 0021). */
export interface ConnectLinkDto {
  url: string;
}

/** Who an anonymous visitor is connecting with (L2-082). */
export interface ConnectLookupDto {
  leadProfileId: string;
  leadName: string;
  leadPhotoUrl: string | null;
  leadChapterName: string | null;
  /** The name of the lead's role that gives them a link. */
  leadRole: string;
  /** The chapter that role is held for, or null when untagged (L2-141 AC3). */
  leadRoleChapterName?: string | null;
}

/** Connected now, waiting for the member's email to be verified, or the lead's own code. */
export type ConnectOutcome = 'Connected' | 'Pending' | 'OwnCode';

export interface ConnectResultDto {
  outcome: ConnectOutcome;
  leadName: string;
}

export interface ConnectSignUpRequest {
  token: string;
  name: string;
  email: string;
  password: string;
}

/** Contract for the connect API (L2-080 to L2-084). Pages depend on CONNECT_SERVICE, never on HttpConnectService. */
export interface ConnectService {
  /** City Leads and System Admins: the caller's reusable link, issued on first use. 403 for anyone else. */
  getMyLink(): Observable<ConnectLinkDto>;
  /** Replaces the caller's link; the old one stops working at once. */
  replaceMyLink(): Observable<ConnectLinkDto>;
  /** Anonymous. 404 for an unknown or replaced link, or an owner who may no longer have one. */
  lookUp(token: string): Observable<ConnectLookupDto>;
  /** Anonymous. The L2-001 rules (400); 202 whether or not the email is registered; 404 for an unusable link. */
  signUp(request: ConnectSignUpRequest): Observable<void>;
  /** Signed in: connects the caller to the link's owner (L2-082 AC4). 404 for an unusable link. */
  connect(token: string): Observable<ConnectResultDto>;
}

export const CONNECT_SERVICE = new InjectionToken<ConnectService>('CONNECT_SERVICE');
