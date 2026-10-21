import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';

import { apiTestProviders } from '../shared/api-test-providers';
import { AGILE_SERVICE } from './agile.service';
import { HttpAgileService } from './http-agile.service';

describe('HttpAgileService', () => {
  let service: HttpAgileService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...apiTestProviders(), { provide: AGILE_SERVICE, useClass: HttpAgileService }],
    });
    service = TestBed.inject(AGILE_SERVICE) as HttpAgileService;
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it.each([
    ['listWorkspaces', () => service.listWorkspaces(), 'GET', '/api/workspaces', undefined],
    [
      'createWorkspace',
      () => service.createWorkspace({ name: 'Ops', method: 'Kanban', memberIds: ['p1'] }),
      'POST',
      '/api/workspaces',
      { name: 'Ops', method: 'Kanban', memberIds: ['p1'] },
    ],
    ['getWorkspace', () => service.getWorkspace('w1'), 'GET', '/api/workspaces/w1', undefined],
    [
      'renameWorkspace',
      () => service.renameWorkspace('w1', 'Team'),
      'PUT',
      '/api/workspaces/w1',
      { name: 'Team' },
    ],
    [
      'listMemberCandidates for a new workspace',
      () => service.listMemberCandidates(),
      'GET',
      '/api/workspaces/candidates',
      undefined,
    ],
    [
      'listMemberCandidates for a workspace',
      () => service.listMemberCandidates('w1'),
      'GET',
      '/api/workspaces/w1/candidates',
      undefined,
    ],
    [
      'addMembers',
      () => service.addMembers('w1', ['p1', 'p2']),
      'POST',
      '/api/workspaces/w1/members',
      { profileIds: ['p1', 'p2'] },
    ],
    [
      'removeMember',
      () => service.removeMember('w1', 'p1'),
      'DELETE',
      '/api/workspaces/w1/members/p1',
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
