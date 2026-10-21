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

export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
}

/** Contract for the auth API. Pages depend on AUTH_SERVICE, never on HttpAuthService. */
export interface AuthService {
  readonly isAuthenticated: Signal<boolean>;
  readonly roles: Signal<Role[]>;

  /** Starts the authorization-code + PKCE flow; the browser leaves the app. */
  signIn(returnUrl?: string, keepSignedIn?: boolean): Promise<void>;
  /** Completes sign-in from the callback query string; resolves to the url to navigate to. */
  completeSignIn(search: string): Promise<string>;
  signOut(): Observable<void>;

  signUp(request: SignUpRequest): Observable<void>;
  confirmEmail(userId: string, token: string): Observable<void>;
  resendVerification(email: string): Observable<void>;
  requestPasswordReset(email: string): Observable<void>;
  resetPassword(email: string, token: string, newPassword: string): Observable<void>;
}

export const AUTH_SERVICE = new InjectionToken<AuthService>('AUTH_SERVICE');
