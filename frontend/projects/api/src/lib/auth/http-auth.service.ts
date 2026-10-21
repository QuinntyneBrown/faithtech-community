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
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../config';
import { AuthService, SignUpRequest } from './auth.service';
import { OidcAuthClient } from './oidc-auth-client.service';

/** Wraps the account endpoints and delegates session handling to OidcAuthClient. */
@Injectable()
export class HttpAuthService implements AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly oidc = inject(OidcAuthClient);

  readonly isAuthenticated = this.oidc.isAuthenticated;
  readonly roles = this.oidc.roles;

  signIn(returnUrl?: string, keepSignedIn?: boolean): Promise<void> {
    return this.oidc.signIn(returnUrl, keepSignedIn);
  }

  completeSignIn(search: string): Promise<string> {
    return this.oidc.handleCallback(search);
  }

  signOut(): Observable<void> {
    return this.oidc.signOut();
  }

  signUp(request: SignUpRequest): Observable<void> {
    return this.post('sign-up', request);
  }

  confirmEmail(userId: string, token: string): Observable<void> {
    return this.post('confirm-email', { userId, token });
  }

  resendVerification(email: string): Observable<void> {
    return this.post('resend-verification', { email });
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.post('forgot-password', { email });
  }

  resetPassword(email: string, token: string, newPassword: string): Observable<void> {
    return this.post('reset-password', { email, token, newPassword });
  }

  private post(action: string, body: unknown): Observable<void> {
    return this.http.post(`${this.base}/account/${action}`, body).pipe(map(() => undefined));
  }
}
