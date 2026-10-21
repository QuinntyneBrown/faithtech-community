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

  it('adds a role and returns the updated role set', () => {
    let roles: string[] = [];
    service.addRole('p1', 'Volunteer').subscribe((r) => (roles = r));

    const req = controller.expectOne('/api/profiles/p1/roles');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ role: 'Volunteer' });
    req.flush(['Volunteer']);
    expect(roles).toEqual(['Volunteer']);
  });

  it('removes a role', () => {
    service.removeRole('p1', 'Volunteer').subscribe();

    const req = controller.expectOne('/api/profiles/p1/roles/Volunteer');
    expect(req.request.method).toBe('DELETE');
    req.flush([]);
  });
});
