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

import { firstValueFrom } from 'rxjs';

import { HANDLES_FORBIDDEN } from '../errors';
import { AUTH_SERVICE } from './auth.service';
import { HttpAuthService } from './http-auth.service';
import { authTestProviders } from './test-helpers';

describe('HttpAuthService', () => {
  let service: HttpAuthService;
  let controller: HttpTestingController;
  let redirect: ReturnType<typeof vi.fn<(url: string) => void>>;

  beforeEach(() => {
    redirect = vi.fn<(url: string) => void>();
    TestBed.configureTestingModule({
      providers: [
        ...authTestProviders(redirect),
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
      'confirmEmail joining this organisation (L2-132 AC1)',
      () => service.confirmEmail('u1', 'tok', { name: 'Grace O.', join: 'j1' }),
      '/api/account/verify-email',
      { userId: 'u1', token: 'tok', name: 'Grace O.', join: 'j1' },
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

  it('restores a stored session by refreshing and loading the current user', async () => {
    sessionStorage.setItem('ft.oidc.refresh', 'r1');

    const restored = service.restoreSession();
    controller
      .expectOne('https://app.test/connect/token')
      .flush({ access_token: 'a1', refresh_token: 'r2', expires_in: 900 });
    await vi.waitFor(() =>
      controller
        .expectOne('/api/me')
        .flush({ id: 'u1', name: 'Ada', email: 'a@b.c', emailVerified: true, roles: [] }),
    );

    await expect(restored).resolves.toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.name).toBe('Ada');
    sessionStorage.clear();
  });

  it('reports no session when nothing is stored', async () => {
    sessionStorage.clear();
    localStorage.clear();

    await expect(service.restoreSession()).resolves.toBe(false);
  });

  // L2-133 AC1, L2-135 AC7: the held roles come named by the organisation, with the capabilities they allow.
  it('loads the current user and exposes the held roles and capabilities', () => {
    const me = {
      id: 'u1',
      profileId: 'p1',
      name: 'Ada',
      email: 'a@b.c',
      emailVerified: false,
      roles: [
        { id: 'r1', key: 'EventLead', name: 'Event Lead', chapterId: null, isOversight: false },
        { id: 'r2', key: 'Volunteer', name: 'Volunteer', chapterId: null, isOversight: false },
      ],
      capabilities: ['ManageEvents', 'JoinWorkspaces'],
    };
    service.loadCurrentUser().subscribe();

    controller.expectOne('/api/me').flush(me);

    expect(service.currentUser()).toEqual(me);
    expect(service.roles()).toEqual(['EventLead', 'Volunteer']);
    expect(service.capabilities()).toEqual(['ManageEvents', 'JoinWorkspaces']);
  });

  // Traces to: L2-078
  it('tells a signed-in account with no profile here that it is not a member (L2-132 AC3)', async () => {
    const loaded = firstValueFrom(service.loadCurrentUser());

    const request = controller.expectOne('/api/me');
    expect(request.request.context.get(HANDLES_FORBIDDEN)).toBe(true);
    request.flush(
      {
        reason: 'not-a-member',
        organisation: { name: 'Northside Makers' },
        email: 'grace@example.org',
        memberships: [{ name: 'FaithTech Community', host: 'app.faithtech.community' }],
      },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(await loaded).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.notAMember()).toEqual({
      reason: 'not-a-member',
      organisation: { name: 'Northside Makers' },
      email: 'grace@example.org',
      memberships: [{ name: 'FaithTech Community', host: 'app.faithtech.community' }],
    });
  });

  it('sends the browser to the API to start Google sign-in with where to land', () => {
    service.signInWithGoogle('/events', true);

    expect(redirect).toHaveBeenCalledWith(
      '/api/account/google/start?returnUrl=%2Fevents&keepSignedIn=true',
    );
  });

  it('marks a Google start from the sign-up form as a sign-up (L2-132 AC7)', () => {
    service.signInWithGoogle('/', false, true);

    expect(redirect).toHaveBeenCalledWith(
      '/api/account/google/start?returnUrl=%2F&keepSignedIn=false&signUp=true',
    );
  });
});
