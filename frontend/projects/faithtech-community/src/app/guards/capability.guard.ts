import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AUTH_SERVICE, Capability, hasAny } from '@faithtech-community/api';

/**
 * Lets in a member holding any of `capabilities` (an administrator holds them all), and sends anyone else to the forbidden page. A convenience only:
 * the API refuses the same callers (AGENTS.md: never rely on the UI to hide data).
 */
export const capabilityGuard =
  (...capabilities: Capability[]): CanActivateFn =>
  () => {
    const held = inject(AUTH_SERVICE).capabilities();
    return hasAny(held, ...capabilities) ? true : inject(Router).createUrlTree(['/forbidden']);
  };
