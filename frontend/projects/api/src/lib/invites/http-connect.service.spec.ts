import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { apiTestProviders } from '../shared/api-test-providers';
import { CONNECT_SERVICE } from './connect.service';
import { HttpConnectService } from './http-connect.service';

describe('HttpConnectService', () => {
  let service: HttpConnectService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: CONNECT_SERVICE, useClass: HttpConnectService },
      ],
    });
    service = TestBed.inject(CONNECT_SERVICE) as HttpConnectService;
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it.each([
    ['getMyLink', () => service.getMyLink(), 'GET', '/api/connect/link', null],
    ['replaceMyLink', () => service.replaceMyLink(), 'POST', '/api/connect/link', null],
    // The token goes in the body, never the URL (L2-043).
    ['lookUp', () => service.lookUp('t-k'), 'POST', '/api/connect/lookup', { token: 't-k' }],
    ['connect', () => service.connect('t-k'), 'POST', '/api/connect', { token: 't-k' }],
    [
      'signUp',
      () => service.signUp({ token: 't', name: 'Ada', email: 'a@b.c', password: 'pw' }),
      'POST',
      '/api/connect/sign-up',
      { token: 't', name: 'Ada', email: 'a@b.c', password: 'pw' },
    ],
  ])('%s', (_name, call, method, url, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe(method);
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });
});
