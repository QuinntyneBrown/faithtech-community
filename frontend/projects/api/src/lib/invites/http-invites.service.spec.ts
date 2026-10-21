import { HttpContext } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { HANDLES_FORBIDDEN } from '../errors';
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

  afterEach(() => controller.verify());

  it.each([
    [
      'sendInvite with a role and note',
      () => service.sendInvite({ email: 'a@b.c', preassignedRole: 'Volunteer', note: 'Hi' }),
      'POST',
      '/api/invites',
      { email: 'a@b.c', preassignedRole: 'Volunteer', note: 'Hi' },
    ],
    ['listInvites', () => service.listInvites(), 'GET', '/api/invites', undefined],
    ['resendInvite', () => service.resendInvite('i1'), 'POST', '/api/invites/i1/resend', null],
    ['revokeInvite', () => service.revokeInvite('i1'), 'POST', '/api/invites/i1/revoke', null],
    ['getInvite', () => service.getInvite('t-k'), 'GET', '/api/invites/by-token/t-k', undefined],
    [
      'accept as a new account',
      () => service.acceptInvite('tok', { name: 'Ada', password: 'pw' }),
      'POST',
      '/api/invites/accept',
      { token: 'tok', name: 'Ada', password: 'pw' },
    ],
    [
      'accept as the signed-in account',
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

  it('lets the send dialog show a refusal itself', () => {
    service.sendInvite({ email: 'a@b.c' }).subscribe({ error: () => undefined });
    service.resendInvite('i1').subscribe({ error: () => undefined });

    const send = controller.expectOne('/api/invites');
    const resend = controller.expectOne('/api/invites/i1/resend');
    for (const req of [send, resend]) {
      expect((req.request.context as HttpContext).get(HANDLES_FORBIDDEN)).toBe(true);
      req.flush(null);
    }
  });
});
