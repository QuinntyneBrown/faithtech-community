/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/admin/admin-users-and-override
 *   - docs/detailed-designs/admin/suspend-users
 */
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpAdminUsersService } from './http-admin-users.service';
import { ADMIN_USERS_SERVICE } from './admin-users.service';

describe('HttpAdminUsersService', () => {
  let service: HttpAdminUsersService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: ADMIN_USERS_SERVICE, useClass: HttpAdminUsersService },
      ],
    });
    service = TestBed.inject(ADMIN_USERS_SERVICE) as HttpAdminUsersService;
    controller = TestBed.inject(HttpTestingController);
  });

  it.each([
    ['search', () => service.search('ada', 2), 'GET', '/api/admin/users?q=ada&page=2', undefined],
    [
      'search without a term',
      () => service.search(''),
      'GET',
      '/api/admin/users?page=1',
      undefined,
    ],
    [
      'suspend',
      () => service.suspend('u1', 'Spam'),
      'POST',
      '/api/admin/users/u1/suspension',
      { reason: 'Spam' },
    ],
    [
      'reinstate',
      () => service.reinstate('u1'),
      'DELETE',
      '/api/admin/users/u1/suspension',
      undefined,
    ],
  ])('%s', (_name, call, method, url, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(null);
  });
});
