import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { HANDLES_FORBIDDEN } from '../errors';
import { apiTestProviders } from '../shared/api-test-providers';
import { HttpPartnersService } from './http-partners.service';
import { LogPartnerActivityRequest, PARTNERS_SERVICE, PartnerRequest } from './partners.service';

const request: PartnerRequest = {
  name: 'Kestrel Labs',
  website: 'kestrel.example',
  offering: 'Venue for Builders Night',
  ownerId: 'p1',
  contactName: 'Nadia Petrov',
  email: null,
  phone: null,
  notes: null,
};

const activity: LogPartnerActivityRequest = {
  kind: 'Call',
  summary: 'Called Nadia about the contract.',
  occurredOn: '2026-10-21',
  occurredAt: '14:15',
  nextStep: 'Send credit-line wording',
  nextStepDue: '2026-10-22',
};

describe('HttpPartnersService', () => {
  let service: HttpPartnersService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: PARTNERS_SERVICE, useClass: HttpPartnersService },
      ],
    });
    service = TestBed.inject(PARTNERS_SERVICE) as HttpPartnersService;
    controller = TestBed.inject(HttpTestingController);
  });

  it.each([
    ['getBoard', () => service.getBoard(), 'GET', '/api/partners', undefined],
    ['get', () => service.get('x1'), 'GET', '/api/partners/x1', undefined],
    ['owners', () => service.owners(), 'GET', '/api/partners/owners', undefined],
    [
      'create',
      () => service.create({ ...request, stage: 'InFunnel' }),
      'POST',
      '/api/partners',
      { ...request, stage: 'InFunnel' },
    ],
    ['update', () => service.update('x1', request), 'PUT', '/api/partners/x1', request],
    [
      'move',
      () => service.move('x1', 'Confirmed', 'Contract signed.'),
      'POST',
      '/api/partners/x1/stage',
      { to: 'Confirmed', note: 'Contract signed.' },
    ],
    ['activities', () => service.activities('x1'), 'GET', '/api/partners/x1/activities', undefined],
    [
      'activities with a filter and a cursor',
      () => service.activities('x1', 'Stage', 'abc'),
      'GET',
      '/api/partners/x1/activities?kind=Stage&before=abc',
      undefined,
    ],
    [
      'logActivity',
      () => service.logActivity('x1', activity),
      'POST',
      '/api/partners/x1/activities',
      activity,
    ],
  ])('%s', (_name, call, method, url, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('lets the partners page show its own forbidden state', () => {
    service.getBoard().subscribe();

    expect(controller.expectOne('/api/partners').request.context.get(HANDLES_FORBIDDEN)).toBe(true);
  });
});
