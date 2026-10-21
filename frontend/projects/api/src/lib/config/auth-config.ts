/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 */
import { InjectionToken } from '@angular/core';

export interface AuthConfig {
  /** Origin of the identity server that hosts /connect/*. */
  authority: string;
  clientId: string;
  scope: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}

// TODO(slice): the designs give no client id, scopes or redirect URIs; these defaults are placeholders.
export function defaultAuthConfig(origin: string): AuthConfig {
  return {
    authority: origin,
    clientId: 'faithtech-community-web',
    scope: 'openid profile offline_access',
    redirectUri: `${origin}/auth/callback`,
    postLogoutRedirectUri: origin,
  };
}

export const AUTH_CONFIG = new InjectionToken<AuthConfig>('AUTH_CONFIG');
