import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AUTH_SERVICE } from '@faithtech-community/api';

/**
 * Sends a signed-out visitor to sign in, remembering the page they asked for (L2-003 AC1), and a signed-in account
 * with no profile on this host to the not-a-member page, which it never leaves for another (L2-132 AC3).
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AUTH_SERVICE);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
  }
  return auth.notAMember() ? router.createUrlTree(['/not-a-member']) : true;
};

/** The not-a-member page is only for an account /api/me refused; anyone else goes home. */
export const notAMemberGuard: CanActivateFn = () =>
  inject(AUTH_SERVICE).notAMember() ? true : inject(Router).createUrlTree(['/']);

/**
 * Matches the system pages (not found, forbidden, server error, offline) inside the app shell for a member of this
 * organisation; anyone else gets them inside the public shell (L2-048).
 */
export const memberMatch: CanMatchFn = () => {
  const auth = inject(AUTH_SERVICE);
  return auth.isAuthenticated() && !auth.notAMember();
};
