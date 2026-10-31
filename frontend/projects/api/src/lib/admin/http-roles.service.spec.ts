import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiTestProviders } from '../shared/api-test-providers';
import { HttpRolesService } from './http-roles.service';
import { ROLES_SERVICE } from './roles.service';

describe('HttpRolesService', () => {
  let service: HttpRolesService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...apiTestProviders(), { provide: ROLES_SERVICE, useClass: HttpRolesService }],
    });
    service = TestBed.inject(ROLES_SERVICE) as HttpRolesService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('adds a role by id and returns the held roles', () => {
    const held = [{ id: 'r6', name: 'Volunteer', chapterId: null }];
    let roles: unknown[] = [];
    service.addRole('p1', 'r6').subscribe((r) => (roles = r));

    const req = controller.expectOne('/api/profiles/p1/roles');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ roleId: 'r6' });
    req.flush(held);
    expect(roles).toEqual(held);
  });

  it('removes a role by id', () => {
    service.removeRole('p1', 'r6').subscribe();

    const req = controller.expectOne('/api/profiles/p1/roles/r6');
    expect(req.request.method).toBe('DELETE');
    req.flush([]);
  });
});
