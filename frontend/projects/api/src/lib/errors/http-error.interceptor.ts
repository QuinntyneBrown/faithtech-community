/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/platform/error-and-system-pages
 */
import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AUTH_SERVICE } from '../auth/auth.service';

/** Set on a request whose caller shows its own forbidden state or refusal, so a 403 is not redirected. */
export const HANDLES_FORBIDDEN = new HttpContextToken<boolean>(() => false);

/**
 * Set on an advisory request whose failure the caller ignores, such as the contact form's duplicate
 * check (L2-116 AC7), so a 500 does not leave the page for the error page.
 */
export const HANDLES_SERVER_ERROR = new HttpContextToken<boolean>(() => false);

/**
 * Routes 403 and 500 to the system pages. Every other status, including 401 (handled by
 * authInterceptor), is left to the calling page. The error is always rethrown.
 *
 * Any 403 also reloads /api/me: the app showed an action it believed allowed, so the caller's roles
 * may have changed, and the navigation and pages follow the fresh capabilities (L2-133 AC5).
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 403 && !isMe(req.url)) {
          // Resolved lazily: the auth service itself sends requests through this interceptor.
          injector
            .get(AUTH_SERVICE, null)
            ?.loadCurrentUser()
            .subscribe({ error: () => undefined });
        }
        if (error.status === 403 && !req.context.get(HANDLES_FORBIDDEN)) {
          void router.navigate(['/forbidden']);
        } else if (error.status === 500 && !req.context.get(HANDLES_SERVER_ERROR)) {
          void router.navigate(['/error'], {
            state: { referenceId: error.headers.get('X-Correlation-ID') },
          });
        }
      }
      return throwError(() => error);
    }),
  );
};

/** /api/me answers 403 for an account with no profile here; reloading it would only repeat that. */
function isMe(url: string): boolean {
  return /\/api\/me(\?|$)/.test(url);
}
