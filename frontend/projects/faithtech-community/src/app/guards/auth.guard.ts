import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AUTH_SERVICE } from '@faithtech-community/api';

/** Sends a signed-out visitor to sign in, remembering the page they asked for (L2-003 AC1). */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AUTH_SERVICE);
  return auth.isAuthenticated()
    ? true
    : inject(Router).createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
};
