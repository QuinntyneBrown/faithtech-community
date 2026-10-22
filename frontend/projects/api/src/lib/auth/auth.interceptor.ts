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
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { API_BASE_URL } from '../config';
import { OidcAuthClient } from './oidc-auth-client.service';

// Anonymous endpoints never carry a token (L2-042).
const ANONYMOUS = [
  '/public/',
  '/invites/lookup',
  '/announcements/unsubscribe',
  '/account/sign-in',
  '/account/sign-up',
  '/account/verify-email',
  '/account/resend-verification',
  '/account/forgot-password',
  '/account/reset-password',
];

/**
 * Adds the bearer token to API requests. On 401 it refreshes once and retries; if that fails the
 * user is sent back through sign-in with the current url as the return url.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  const oidc = inject(OidcAuthClient);
  if (!req.url.startsWith(base) || ANONYMOUS.some((p) => req.url.startsWith(base + p))) {
    return next(req);
  }

  const withToken = (r: HttpRequest<unknown>, token = oidc.accessToken()) => {
    return token ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : r;
  };

  return next(withToken(req)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return oidc.refresh().pipe(
        switchMap((token) => next(withToken(req, token))),
        catchError(() => {
          void oidc.signIn(window.location.pathname + window.location.search);
          return throwError(() => error);
        }),
      );
    }),
  );
};
