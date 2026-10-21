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
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, firstValueFrom, map, of, switchMap, tap, throwError } from 'rxjs';

import { API_BASE_URL } from '../config';
import {
  AuthService,
  CurrentUser,
  SignInError,
  SignInOutcome,
  SignUpRequest,
} from './auth.service';
import { OidcAuthClient } from './oidc-auth-client.service';

/** Wraps the account endpoints and delegates session handling to OidcAuthClient. */
@Injectable()
export class HttpAuthService implements AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly oidc = inject(OidcAuthClient);

  private readonly user = signal<CurrentUser | null>(null);

  readonly isAuthenticated = this.oidc.isAuthenticated;
  readonly currentUser = this.user.asReadonly();
  readonly roles = computed(() => this.user()?.roles ?? []);

  signIn(returnUrl?: string, keepSignedIn?: boolean): Promise<void> {
    return this.oidc.signIn(returnUrl, keepSignedIn);
  }

  completeSignIn(search: string): Promise<string> {
    return this.oidc.handleCallback(search);
  }

  signInWithPassword(email: string, password: string): Observable<SignInOutcome> {
    return this.http
      .post<{ emailVerified: boolean }>(
        `${this.base}/account/sign-in`,
        { email, password },
        { withCredentials: true },
      )
      .pipe(
        map((r): SignInOutcome => ({ succeeded: true, emailVerified: r.emailVerified })),
        catchError((error: unknown) => {
          const code = (error as HttpErrorResponse).error?.code as SignInError | undefined;
          return error instanceof HttpErrorResponse && error.status === 400 && code
            ? of<SignInOutcome>({ succeeded: false, error: code })
            : throwError(() => error);
        }),
      );
  }

  signOut(): Observable<void> {
    return this.oidc.signOut().pipe(tap(() => this.user.set(null)));
  }

  restoreSession(): Promise<boolean> {
    return firstValueFrom(
      this.oidc.refresh().pipe(
        switchMap(() => this.loadCurrentUser()),
        map(() => true),
        catchError(() => of(false)),
      ),
    );
  }

  loadCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.base}/me`).pipe(tap((u) => this.user.set(u)));
  }

  signUp(request: SignUpRequest): Observable<void> {
    return this.post('sign-up', request);
  }

  confirmEmail(userId: string, token: string): Observable<void> {
    return this.post('verify-email', { userId, token });
  }

  resendVerification(email: string): Observable<void> {
    return this.post('resend-verification', { email });
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.post('forgot-password', { email });
  }

  resetPassword(userId: string, token: string, password: string): Observable<void> {
    return this.post('reset-password', { userId, token, password });
  }

  private post(action: string, body: unknown): Observable<void> {
    return this.http.post(`${this.base}/account/${action}`, body).pipe(map(() => undefined));
  }
}
