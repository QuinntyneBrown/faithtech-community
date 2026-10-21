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
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';

import { OidcAuthClient } from './oidc-auth-client.service';
import { TEST_ORIGIN, authTestProviders, fakeJwt } from './test-helpers';

describe('OidcAuthClient', () => {
  let client: OidcAuthClient;
  let controller: HttpTestingController;
  let redirect: Mock<(url: string) => void>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    redirect = vi.fn<(url: string) => void>();
    TestBed.configureTestingModule({ providers: authTestProviders(redirect) });
    client = TestBed.inject(OidcAuthClient);
    controller = TestBed.inject(HttpTestingController);
  });

  it('redirects to the authorize endpoint with a PKCE S256 challenge', async () => {
    await client.signIn('/events');

    const url = new URL(redirect.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(`${TEST_ORIGIN}/connect/authorize`);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('redirect_uri')).toBe(`${TEST_ORIGIN}/auth/callback`);
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('client_id')).toBe('web');
    expect(url.searchParams.get('scope')).toBe('openid profile email roles offline_access');
  });

  it('exchanges the code with the verifier, stores the token and returns the original url', async () => {
    const access = fakeJwt({});
    await client.signIn('/events');
    const state = new URL(redirect.mock.calls[0][0]).searchParams.get('state');

    const done = client.handleCallback(`?code=abc&state=${state}`);
    const req = await vi.waitFor(() => controller.expectOne(`${TEST_ORIGIN}/connect/token`));
    expect(req.request.method).toBe('POST');
    const body = new URLSearchParams(req.request.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('abc');
    expect(body.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    req.flush({ access_token: access, refresh_token: 'r1', expires_in: 3600 });

    await expect(done).resolves.toBe('/events');
    expect(client.isAuthenticated()).toBe(true);
    expect(client.accessToken()).toBe(access);
  });

  it('rejects a callback whose state does not match', async () => {
    await client.signIn('/');

    await expect(client.handleCallback('?code=abc&state=forged')).rejects.toThrow(/state/i);
    expect(client.isAuthenticated()).toBe(false);
  });

  it.each([
    [false, sessionStorage],
    [true, localStorage],
  ])('keeps the refresh token in the right store when keepSignedIn=%s', async (keep, store) => {
    await client.signIn('/', keep);
    const state = new URL(redirect.mock.calls[0][0]).searchParams.get('state');
    const done = client.handleCallback(`?code=abc&state=${state}`);
    const req = await vi.waitFor(() => controller.expectOne(`${TEST_ORIGIN}/connect/token`));
    req.flush({ access_token: fakeJwt({}), refresh_token: 'r1', expires_in: 3600 });
    await done;

    expect(Object.values(store).includes('r1') || JSON.stringify(store).includes('r1')).toBe(true);
  });

  it('refreshes with the refresh token and publishes the new access token', async () => {
    const first = await startSession('r1');

    const next = fakeJwt({ n: 2 });
    let result: string | null = null;
    client.refresh().subscribe((t) => (result = t));
    const req = controller.expectOne(`${TEST_ORIGIN}/connect/token`);
    const body = new URLSearchParams(req.request.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('r1');
    req.flush({ access_token: next, refresh_token: 'r2', expires_in: 3600 });

    expect(result).toBe(next);
    expect(client.accessToken()).toBe(next);
    expect(first).not.toBe(next);
  });

  it('signs out by revoking every token on the server and clearing the session', async () => {
    const access = await startSession('r1');

    client.signOut().subscribe();
    const req = controller.expectOne('/api/account/sign-out');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${access}`);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(sessionStorage.length + localStorage.length).toBe(0);

    expect(client.isAuthenticated()).toBe(false);
    expect(redirect).toHaveBeenLastCalledWith(TEST_ORIGIN);
  });

  async function startSession(refreshToken: string): Promise<string> {
    const access = fakeJwt({ n: 1 });
    await client.signIn('/');
    const state = new URL(redirect.mock.calls[0][0]).searchParams.get('state');
    const done = client.handleCallback(`?code=abc&state=${state}`);
    const req = await vi.waitFor(() => controller.expectOne(`${TEST_ORIGIN}/connect/token`));
    req.flush({ access_token: access, refresh_token: refreshToken, expires_in: 3600 });
    await done;
    return access;
  }
});
