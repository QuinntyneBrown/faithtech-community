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
import { EnvironmentProviders, Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { API_BASE_URL, AUTH_CONFIG, defaultAuthConfig } from '../config';
import { BROWSER_REDIRECT } from './browser-redirect';

export const TEST_ORIGIN = 'https://app.test';

/** Builds an unsigned JWT whose payload is the given claims. */
export function fakeJwt(claims: Record<string, unknown>): string {
  return `h.${btoa(JSON.stringify(claims))}.s`;
}

export function authTestProviders(
  redirect: (url: string) => void,
): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: API_BASE_URL, useValue: '/api' },
    { provide: AUTH_CONFIG, useValue: defaultAuthConfig(TEST_ORIGIN) },
    { provide: BROWSER_REDIRECT, useValue: redirect },
  ];
}
