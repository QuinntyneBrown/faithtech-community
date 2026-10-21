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

import { AUTH_SERVICE } from './auth.service';
import { HttpAuthService } from './http-auth.service';
import { authTestProviders } from './test-helpers';

describe('HttpAuthService', () => {
  let service: HttpAuthService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...authTestProviders(vi.fn<(url: string) => void>()),
        { provide: AUTH_SERVICE, useClass: HttpAuthService },
      ],
    });
    service = TestBed.inject(AUTH_SERVICE) as HttpAuthService;
    controller = TestBed.inject(HttpTestingController);
  });

  it.each([
    [
      'signUp',
      () => service.signUp({ name: 'Ada', email: 'a@b.c', password: 'pw' }),
      '/api/account/sign-up',
      { name: 'Ada', email: 'a@b.c', password: 'pw' },
    ],
    [
      'confirmEmail',
      () => service.confirmEmail('u1', 'tok'),
      '/api/account/verify-email',
      { userId: 'u1', token: 'tok' },
    ],
    [
      'resendVerification',
      () => service.resendVerification('a@b.c'),
      '/api/account/resend-verification',
      { email: 'a@b.c' },
    ],
    [
      'requestPasswordReset',
      () => service.requestPasswordReset('a@b.c'),
      '/api/account/forgot-password',
      { email: 'a@b.c' },
    ],
    [
      'resetPassword',
      () => service.resetPassword('u1', 'tok', 'newpw'),
      '/api/account/reset-password',
      { userId: 'u1', token: 'tok', password: 'newpw' },
    ],
  ])('%s posts to the account endpoint', (_name, call, url, body) => {
    call().subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('signs in with a password and reports whether the email is verified', () => {
    let outcome: unknown;
    service.signInWithPassword('a@b.c', 'pw').subscribe((o) => (outcome = o));

    const req = controller.expectOne('/api/account/sign-in');
    expect(req.request.body).toEqual({ email: 'a@b.c', password: 'pw' });
    expect(req.request.withCredentials).toBe(true);
    req.flush({ emailVerified: false });

    expect(outcome).toEqual({ succeeded: true, emailVerified: false });
  });

  it.each(['invalid_credentials', 'locked_out', 'suspended'])(
    'reports the %s sign-in error code',
    (code) => {
      let outcome: unknown;
      service.signInWithPassword('a@b.c', 'pw').subscribe((o) => (outcome = o));

      controller
        .expectOne('/api/account/sign-in')
        .flush({ code }, { status: 400, statusText: 'Bad Request' });

      expect(outcome).toEqual({ succeeded: false, error: code });
    },
  );

  it('loads the current user and exposes the roles', () => {
    const me = {
      id: 'u1',
      name: 'Ada',
      email: 'a@b.c',
      emailVerified: false,
      roles: ['Lead', 'Volunteer'],
    };
    service.loadCurrentUser().subscribe();

    controller.expectOne('/api/me').flush(me);

    expect(service.currentUser()).toEqual(me);
    expect(service.roles()).toEqual(['Lead', 'Volunteer']);
  });
});
