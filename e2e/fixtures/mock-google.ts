import { Route } from '@playwright/test';

import type { MockAccount, MockApi } from './mock-api';

/** The Google account the visitor picks at Google's consent screen; null when they cancel. */
export interface MockGoogleAccount {
  email: string;
  name: string;
  emailVerified: boolean;
}

const MARKETING = 'http://localhost:4300';
const COMMUNITY = 'http://localhost:4200';
const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';

/**
 * A browser redirect. Playwright does not route the request a fulfilled 302 leads to, so each hop answers
 * with a page that navigates on, keeping every request of the flow inside the fake.
 */
function redirect(route: Route, location: string) {
  return route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html><title>Redirecting</title><script>location.replace(${JSON.stringify(location)})</script>`,
  });
}

/**
 * Plays Google and the API's Google endpoints (AccountEndpoints, GoogleSignInHandler; ADR 0019) so the
 * marketing page's real redirects run without the network: start sends the browser to "Google", which
 * returns to the callback, which applies the server's rules and lands in the community app or back on
 * the marketing page with ?google=failed|suspended.
 */
export class MockGoogle {
  /** Who signs in at Google. Set it before pressing the button; null plays "Cancel". */
  account: MockGoogleAccount | null = null;
  private pending: { state: string; returnUrl: string; keepSignedIn: string } | null = null;

  constructor(
    private readonly api: MockApi,
    private readonly signIn: (account: MockAccount) => void,
  ) {}

  /** GET /api/account/google/start */
  start(route: Route, url: URL) {
    const returnUrl = url.searchParams.get('returnUrl') ?? '/';
    this.pending = {
      state: `state-${Date.now()}`,
      returnUrl: returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/',
      keepSignedIn: url.searchParams.get('keepSignedIn') === 'true' ? '1' : '0',
    };
    const google = new URL(AUTHORIZE);
    google.searchParams.set('state', this.pending.state);
    google.searchParams.set('redirect_uri', `${COMMUNITY}/api/account/google/callback`);
    return redirect(route, google.toString());
  }

  /** accounts.google.com: consent, then back to the callback with a code or an error. */
  consent(route: Route) {
    const url = new URL(route.request().url());
    const back = new URL(url.searchParams.get('redirect_uri')!);
    back.searchParams.set('state', url.searchParams.get('state') ?? '');
    if (this.account) back.searchParams.set('code', 'google-code');
    else back.searchParams.set('error', 'access_denied');
    return redirect(route, back.toString());
  }

  /** GET /api/account/google/callback */
  callback(route: Route, url: URL) {
    const pending = this.pending;
    this.pending = null;
    const google = this.account;
    const failed = (outcome: string) => redirect(route, `${MARKETING}/?google=${outcome}`);
    if (!pending || url.searchParams.get('state') !== pending.state || !google) {
      return failed('failed');
    }
    if (!google.emailVerified) return failed('failed');
    const account =
      this.api.accounts.get(google.email.toLowerCase()) ??
      this.api.addAccount({ email: google.email, name: google.name, verified: true, roles: [] });
    account.verified = true;
    if (account.suspended) return failed('suspended');
    this.signIn(account);
    const query = new URLSearchParams({
      returnUrl: pending.returnUrl,
      keepSignedIn: pending.keepSignedIn,
    });
    return redirect(route, `${COMMUNITY}/auth/continue?${query}`);
  }
}
