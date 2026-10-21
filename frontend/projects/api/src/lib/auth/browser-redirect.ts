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
import { InjectionToken } from '@angular/core';

/** Full-page navigation, injectable so the OIDC redirects can be observed in tests. */
export const BROWSER_REDIRECT = new InjectionToken<(url: string) => void>('BROWSER_REDIRECT', {
  providedIn: 'root',
  factory: () => (url: string) => window.location.assign(url),
});
