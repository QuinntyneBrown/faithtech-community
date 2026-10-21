/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/invites/send-invite
 *   - docs/detailed-designs/invites/accept-invite
 */
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpInvitesService } from './http-invites.service';
import { INVITES_SERVICE } from './invites.service';

describe('HttpInvitesService', () => {
  let service: HttpInvitesService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: INVITES_SERVICE, useClass: HttpInvitesService },
      ],
    });
    service = TestBed.inject(INVITES_SERVICE) as HttpInvitesService;
    controller = TestBed.inject(HttpTestingController);
  });

  it.each([
    [
      'sendInvite with a role',
      () => service.sendInvite('a@b.c', 'Volunteer'),
      'POST',
      '/api/invites',
      { email: 'a@b.c', preassignedRole: 'Volunteer' },
    ],
    [
      'sendInvite without a role',
      () => service.sendInvite('a@b.c'),
      'POST',
      '/api/invites',
      { email: 'a@b.c', preassignedRole: null },
    ],
    ['listInvites', () => service.listInvites(), 'GET', '/api/invites', undefined],
    ['revokeInvite', () => service.revokeInvite('i1'), 'POST', '/api/invites/i1/revoke', undefined],
    [
      'getInvite',
      () => service.getInvite('tok'),
      'GET',
      '/api/invites/by-token?token=tok',
      undefined,
    ],
    [
      'accept as a new account',
      () => service.acceptInvite('tok', { name: 'Ada', password: 'pw' }),
      'POST',
      '/api/invites/accept',
      { token: 'tok', name: 'Ada', password: 'pw' },
    ],
    [
      'accept as a signed-in account',
      () => service.acceptInvite('tok'),
      'POST',
      '/api/invites/accept',
      { token: 'tok', name: null, password: null },
    ],
  ])('%s', (_name, call, method, url, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(null);
  });
});
