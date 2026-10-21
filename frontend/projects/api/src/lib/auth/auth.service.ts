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

import { Role } from '../shared';

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  roles: Role[];
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
  readonly roles: Signal<Role[]>;
  /** The signed-in member, loaded from /api/me; null until loaded or when signed out. */
  readonly currentUser: Signal<CurrentUser | null>;

  /** Starts the authorization-code + PKCE flow; the browser leaves the app. */
  signIn(returnUrl?: string, keepSignedIn?: boolean): Promise<void>;
  /** Completes sign-in from the callback query string; resolves to the url to navigate to. */
  completeSignIn(search: string): Promise<string>;
  /** Posts credentials to the identity server, which starts a short browser session for /connect/authorize. */
  signInWithPassword(email: string, password: string): Observable<SignInOutcome>;
  signOut(): Observable<void>;
  loadCurrentUser(): Observable<CurrentUser>;

  signUp(request: SignUpRequest): Observable<void>;
  confirmEmail(userId: string, token: string): Observable<void>;
  resendVerification(email: string): Observable<void>;
  requestPasswordReset(email: string): Observable<void>;
  resetPassword(userId: string, token: string, password: string): Observable<void>;
}

export const AUTH_SERVICE = new InjectionToken<AuthService>('AUTH_SERVICE');
