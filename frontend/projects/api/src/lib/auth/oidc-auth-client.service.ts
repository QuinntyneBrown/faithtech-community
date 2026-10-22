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
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, map, of, shareReplay, tap } from 'rxjs';

import { API_BASE_URL, AUTH_CONFIG } from '../config';
import { BROWSER_REDIRECT } from './browser-redirect';
import { clearSessionHint, writeSessionHint } from './session-hint';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

const PENDING_KEY = 'ft.oidc.pending';
const REFRESH_KEY = 'ft.oidc.refresh';

/**
 * Owns the OAuth2 authorization-code + PKCE flow against the identity server.
 * Access tokens are encrypted by the server, so member details come from /api/me, never the token.
 */
@Injectable({ providedIn: 'root' })
export class OidcAuthClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AUTH_CONFIG);
  private readonly base = inject(API_BASE_URL);
  private readonly redirect = inject(BROWSER_REDIRECT);

  private readonly token = signal<string | null>(null);
  private inFlightRefresh: Observable<string> | null = null;

  readonly accessToken = this.token.asReadonly();
  readonly isAuthenticated = computed(() => this.token() !== null);

  /** Starts the flow; the browser leaves the app. The user returns to returnUrl after the callback. */
  async signIn(returnUrl = '/', keepSignedIn = false): Promise<void> {
    const verifier = randomString(32);
    const state = randomString(16);
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier, state, returnUrl, keepSignedIn }),
    );

    const query = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope,
      state,
      code_challenge: await challengeFor(verifier),
      code_challenge_method: 'S256',
    });
    this.redirect(`${this.config.authority}/connect/authorize?${query}`);
  }

  /** Completes the flow from the callback query string and returns the url the user first asked for. */
  async handleCallback(search: string): Promise<string> {
    const params = new URLSearchParams(search);
    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as {
      verifier: string;
      state: string;
      returnUrl: string;
      keepSignedIn: boolean;
    } | null;
    sessionStorage.removeItem(PENDING_KEY);
    if (!pending || pending.state !== params.get('state')) {
      throw new Error('Sign-in state did not match.');
    }
    const code = params.get('code');
    if (!code) {
      throw new Error(params.get('error') ?? 'Sign-in did not return a code.');
    }

    const response = await new Promise<TokenResponse>((resolve, reject) =>
      this.postToken({
        grant_type: 'authorization_code',
        code,
        code_verifier: pending.verifier,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
      }).subscribe({ next: resolve, error: reject }),
    );
    this.store(response, pending.keepSignedIn);
    return pending.returnUrl;
  }

  /** Silently exchanges the refresh token. Concurrent callers share one request. */
  refresh(): Observable<string> {
    const refreshToken = this.readRefreshToken();
    if (!refreshToken) {
      clearSessionHint(this.config.sessionHintDomain);
      return new Observable((s) => s.error(new Error('No refresh token.')));
    }
    this.inFlightRefresh ??= this.postToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    }).pipe(
      tap({
        next: (r) => this.store(r, localStorage.getItem(REFRESH_KEY) !== null),
        // The stored session is gone, so the marketing page must stop sending the member here.
        error: () => clearSessionHint(this.config.sessionHintDomain),
      }),
      map((r) => r.access_token),
      finalize(() => (this.inFlightRefresh = null)),
      shareReplay(1),
    );
    return this.inFlightRefresh;
  }

  /** Revokes every token on the server, clears the session and returns to the post-logout url. */
  signOut(): Observable<void> {
    const accessToken = this.token();
    const clearAndLeave = () => {
      this.token.set(null);
      sessionStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(REFRESH_KEY);
      clearSessionHint(this.config.sessionHintDomain);
      this.redirect(this.config.postLogoutRedirectUri);
    };
    if (!accessToken) {
      clearAndLeave();
      return of(undefined);
    }
    return this.http
      .post(`${this.base}/account/sign-out`, null, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .pipe(
        map(() => undefined),
        finalize(clearAndLeave),
      );
  }

  private postToken(form: Record<string, string>): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(
      `${this.config.authority}/connect/token`,
      new URLSearchParams(form).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
  }

  private store(response: TokenResponse, keepSignedIn: boolean): void {
    this.token.set(response.access_token);
    if (!response.refresh_token) return;
    // "Keep me signed in" survives the browser session; otherwise the refresh token is discarded with it.
    const target = keepSignedIn ? localStorage : sessionStorage;
    sessionStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(REFRESH_KEY);
    target.setItem(REFRESH_KEY, response.refresh_token);
    if (keepSignedIn) writeSessionHint(this.config.sessionHintDomain);
    else clearSessionHint(this.config.sessionHintDomain);
  }

  private readRefreshToken(): string | null {
    return sessionStorage.getItem(REFRESH_KEY) ?? localStorage.getItem(REFRESH_KEY);
  }
}

function randomString(bytes: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
