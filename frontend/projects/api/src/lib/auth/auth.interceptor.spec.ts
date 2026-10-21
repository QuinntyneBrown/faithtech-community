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
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { API_BASE_URL } from '../config';
import { authInterceptor } from './auth.interceptor';
import { OidcAuthClient } from './oidc-auth-client.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let token: string | null;
  let oidc: {
    accessToken: () => string | null;
    refresh: ReturnType<typeof vi.fn>;
    signIn: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    token = 't1';
    oidc = { accessToken: () => token, refresh: vi.fn(), signIn: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: OidcAuthClient, useValue: oidc },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  it('adds the bearer token to API requests', () => {
    http.get('/api/profiles/1').subscribe();

    const req = controller.expectOne('/api/profiles/1');
    expect(req.request.headers.get('Authorization')).toBe('Bearer t1');
    req.flush({});
  });

  it.each([
    '/api/public/events/1',
    '/api/invites/by-token?token=x',
    '/api/announcements/unsubscribe',
    '/api/account/sign-in',
    '/api/account/sign-up',
    '/api/account/verify-email',
    '/api/account/resend-verification',
    '/api/account/forgot-password',
    '/api/account/reset-password',
  ])('does not add a token to anonymous endpoint %s', (url) => {
    http.get(url).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('adds the bearer token to sign-out so the server can revoke the session', () => {
    http.post('/api/account/sign-out', null).subscribe();

    const req = controller.expectOne('/api/account/sign-out');
    expect(req.request.headers.get('Authorization')).toBe('Bearer t1');
    req.flush(null);
  });

  it('does not add a token to requests outside the API', () => {
    http.post('https://idp.test/connect/token', {}).subscribe();

    expect(
      controller.expectOne('https://idp.test/connect/token').request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('refreshes once on 401 and retries with the new token', () => {
    oidc.refresh.mockReturnValue(of('t2'));
    let body: unknown;
    http.get('/api/x').subscribe((b) => (body = b));

    controller.expectOne('/api/x').flush({}, { status: 401, statusText: 'Unauthorized' });
    token = 't2';
    const retry = controller.expectOne('/api/x');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer t2');
    retry.flush({ ok: true });

    expect(body).toEqual({ ok: true });
    expect(oidc.refresh).toHaveBeenCalledTimes(1);
  });

  it('sends the user to sign in when the refresh fails', () => {
    oidc.refresh.mockReturnValue(throwError(() => new Error('expired')));
    let failed = false;
    http.get('/api/x').subscribe({ error: () => (failed = true) });

    controller.expectOne('/api/x').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(oidc.signIn).toHaveBeenCalled();
    expect(failed).toBe(true);
  });
});
