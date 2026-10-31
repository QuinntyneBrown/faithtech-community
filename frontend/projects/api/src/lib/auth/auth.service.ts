/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/identity/sign-in-and-sign-out
 *   - docs/detailed-designs/identity/sign-up
 *   - docs/detailed-designs/identity/email-verification
 *   - docs/detailed-designs/identity/password-reset
 */
import { InjectionToken, Signal } from '@angular/core';
import { Observable } from 'rxjs';

import { Capability, HeldRole, Role } from '../shared';
import type { ChapterLabel } from '../site/site.service';

export interface CurrentUser {
  id: string;
  /** The caller's profile id; their avatar colour is derived from it (ADR 0008). */
  profileId: string | null;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  /** The roles held here, named by the organisation (L2-133 AC1). */
  roles: HeldRole[];
  /** What the roles allow, computed by the server on every request (L2-135 AC2). */
  capabilities: Capability[];
  /** The role definition ids the caller may add and remove; every picker offers exactly these (L2-137 AC5). */
  grantableRoleIds?: string[];
  /** The caller's home chapter, or none, and none while chapters are off (L2-133 AC1). */
  chapter?: { id: string; name: string } | null;
  /** The organisation of the host, from /api/me (L2-133 AC1). */
  organisation?: MeOrganisation;
  /** The account's other active memberships, for the switcher (L2-133 AC1, AC3). */
  memberships?: Membership[];
}

/** The organisation part of /api/me. */
export interface MeOrganisation {
  slug: string;
  name: string;
  shortName: string;
  host: string;
  chapterLabel: ChapterLabel | null;
}

/** Another organisation the account belongs to, by name and host (L2-132 AC3, L2-133). */
export interface Membership {
  name: string;
  host: string;
}

/** GET /api/me's 403 body for a signed-in account with no profile in the host's organisation (L2-132 AC3). */
export interface NotAMember {
  reason: 'not-a-member';
  organisation: { name: string };
  /** The account's email, which the not-a-member page says it is signed in as. */
  email: string | null;
  memberships: Membership[];
}

/** The part of a verification link that makes an existing account a member of this organisation (L2-132 AC1). */
export interface JoinLink {
  name: string;
  join: string;
}

export type SignInError = 'invalid_credentials' | 'locked_out' | 'suspended';

export type SignInOutcome =
  { succeeded: true; emailVerified: boolean } | { succeeded: false; error: SignInError };

export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
}

/** Contract for the auth API. Pages depend on AUTH_SERVICE, never on HttpAuthService. */
export interface AuthService {
  readonly isAuthenticated: Signal<boolean>;
  /** The held roles' keys, which role pickers send until they use ids (slice 14). Decide with `capabilities`. */
  readonly roles: Signal<Role[]>;
  /** The caller's capabilities; every show-or-hide decision reads these, never a role name (L2-135 AC7). */
  readonly capabilities: Signal<Capability[]>;
  /** The role definition ids the caller may add and remove (L2-137 AC5). */
  readonly grantableRoleIds: Signal<string[]>;
  /** The signed-in member, loaded from /api/me; null until loaded or when signed out. */
  readonly currentUser: Signal<CurrentUser | null>;
  /** Set when /api/me says the signed-in account has no profile here; the app then shows only the not-a-member page. */
  readonly notAMember: Signal<NotAMember | null>;

  /** Starts the authorization-code + PKCE flow; the browser leaves the app. */
  signIn(returnUrl?: string, keepSignedIn?: boolean): Promise<void>;
  /** Completes sign-in from the callback query string; resolves to the url to navigate to. */
  completeSignIn(search: string): Promise<string>;
  /** Posts credentials to the identity server, which starts a short browser session for /connect/authorize. */
  signInWithPassword(email: string, password: string): Observable<SignInOutcome>;
  /**
   * Starts Google sign-in (one flow for signing in and signing up): the browser leaves for the API, then
   * Google, and lands in the community app at returnUrl, or back here with ?google=failed|suspended.
   */
  /** `signUp` when started from the sign-up form: an existing account then joins the host's organisation (L2-132 AC7). */
  signInWithGoogle(returnUrl?: string, keepSignedIn?: boolean, signUp?: boolean): void;
  signOut(): Observable<void>;
  /**
   * True when the community app keeps a "Keep me signed in" session on this device (the session hint,
   * ADR 0018). It only decides a redirect; the community app validates the session itself.
   */
  hasKeptSession(): boolean;
  /** Loads /api/me; resolves to null, with notAMember set, when the account has no profile here. */
  loadCurrentUser(): Observable<CurrentUser | null>;
  /** On app start: exchanges a stored refresh token and loads the member; false when there is no session. */
  restoreSession(): Promise<boolean>;

  signUp(request: SignUpRequest): Observable<void>;
  /** `joining` carries the name and join token of a link that also makes the account a member here (L2-132 AC1). */
  confirmEmail(userId: string, token: string, joining?: JoinLink): Observable<void>;
  resendVerification(email: string): Observable<void>;
  requestPasswordReset(email: string): Observable<void>;
  resetPassword(userId: string, token: string, password: string): Observable<void>;
}

export const AUTH_SERVICE = new InjectionToken<AuthService>('AUTH_SERVICE');
