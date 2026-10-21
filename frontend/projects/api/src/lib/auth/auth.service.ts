/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/identity/sign-up
 *   - docs/detailed-designs/identity/sign-in-and-sign-out
 *   - docs/detailed-designs/identity/email-verification
 *   - docs/detailed-designs/identity/password-reset
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the auth API. Pages depend on AUTH_SERVICE, never on HttpAuthService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface AuthService {}

export const AUTH_SERVICE = new InjectionToken<AuthService>('AUTH_SERVICE');
