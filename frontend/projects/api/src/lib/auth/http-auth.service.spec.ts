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
      '/api/account/confirm-email',
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
      () => service.resetPassword('a@b.c', 'tok', 'newpw'),
      '/api/account/reset-password',
      { email: 'a@b.c', token: 'tok', newPassword: 'newpw' },
    ],
  ])('%s posts to the account endpoint', (_name, call, url, body) => {
    call().subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });
});
