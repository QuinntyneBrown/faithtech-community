import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import { apiTestProviders } from '../shared/api-test-providers';
import { HttpRoleDefinitionsService } from './http-role-definitions.service';
import { ROLE_DEFINITIONS_SERVICE, RoleDefinitionDto } from './role-definitions.service';

const STEWARD: RoleDefinitionDto = {
  id: 'r1',
  key: 'steward',
  name: 'Steward',
  description: '',
  capabilities: ['ManageRoles'],
  showOnTeam: false,
  chapterScopable: false,
  isOversight: false,
  holderCount: 1,
  archived: false,
  grantableRoleIds: [],
};

const REQUEST = {
  name: 'Steward',
  description: '',
  capabilities: ['ManageRoles'],
  showOnTeam: false,
  isOversight: false,
};

describe('HttpRoleDefinitionsService', () => {
  let service: HttpRoleDefinitionsService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: ROLE_DEFINITIONS_SERVICE, useClass: HttpRoleDefinitionsService },
      ],
    });
    service = TestBed.inject(ROLE_DEFINITIONS_SERVICE) as HttpRoleDefinitionsService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('lists the active or the archived definitions', () => {
    const lists: RoleDefinitionDto[][] = [];
    service.list().subscribe((l) => lists.push(l));
    service.list(true).subscribe((l) => lists.push(l));

    controller.expectOne('/api/organisation/roles').flush([STEWARD]);
    controller.expectOne('/api/organisation/roles?archived=true').flush([]);
    expect(lists).toEqual([[STEWARD], []]);
  });

  it('reads the capability catalogue', () => {
    service.capabilities().subscribe((c) => expect(c[0].key).toBe('ManageEvents'));
    controller
      .expectOne('/api/organisation/capabilities')
      .flush([{ key: 'ManageEvents', description: 'Create, edit and cancel events.' }]);
  });

  it('defines and edits a role, refusals and failures reaching the dialog', () => {
    service.define(REQUEST).subscribe();
    service.update('r1', REQUEST).subscribe();

    const post = controller.expectOne({ method: 'POST', url: '/api/organisation/roles' });
    const put = controller.expectOne({ method: 'PUT', url: '/api/organisation/roles/r1' });
    for (const request of [post.request, put.request]) {
      expect(request.body).toEqual(REQUEST);
      expect(request.context.get(HANDLES_FORBIDDEN)).toBe(true);
      expect(request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    }
    post.flush(STEWARD);
    put.flush(STEWARD);
  });

  it('saves grant rules and archives a role, refusals and failures reaching the dialog', () => {
    service.setGrants('r1', ['r2']).subscribe();
    service.archive('r1').subscribe();

    const put = controller.expectOne({ method: 'PUT', url: '/api/organisation/roles/r1/grants' });
    const post = controller.expectOne({
      method: 'POST',
      url: '/api/organisation/roles/r1/archive',
    });
    expect(put.request.body).toEqual({ grantableRoleIds: ['r2'] });
    for (const request of [put.request, post.request]) {
      expect(request.context.get(HANDLES_FORBIDDEN)).toBe(true);
      expect(request.context.get(HANDLES_SERVER_ERROR)).toBe(true);
    }
    put.flush(STEWARD);
    post.flush(STEWARD);
  });
});
