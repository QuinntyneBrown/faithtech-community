/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/platform/error-and-system-pages
 */
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Routes 403 and 500 to the system pages. Every other status, including 401 (handled by
 * authInterceptor), is left to the calling page. The error is always rethrown.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 403) {
          void router.navigate(['/forbidden']);
        } else if (error.status === 500) {
          void router.navigate(['/error'], {
            state: { referenceId: error.headers.get('X-Correlation-ID') },
          });
        }
      }
      return throwError(() => error);
    }),
  );
};
