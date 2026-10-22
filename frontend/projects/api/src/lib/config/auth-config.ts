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
  /**
   * Domain of the non-secret "kept session" hint cookie the marketing page reads (ADR 0018), such as
   * faithtech.community; unset keeps it host-only, which localhost shares across ports.
   */
  sessionHintDomain?: string;
}

// Matches the public client seeded by the Cli (CommunitySeeder).
export function defaultAuthConfig(origin: string): AuthConfig {
  return {
    authority: origin,
    clientId: 'web',
    scope: 'openid profile email roles offline_access',
    redirectUri: `${origin}/auth/callback`,
    postLogoutRedirectUri: origin,
  };
}

export const AUTH_CONFIG = new InjectionToken<AuthConfig>('AUTH_CONFIG');
