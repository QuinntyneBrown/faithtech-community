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
    ['getBacklog', () => service.getBacklog('w1'), 'GET', '/api/workspaces/w1/backlog', undefined],
    [
      'getBacklog for an epic',
      () => service.getBacklog('w1', { epicId: 'e1' }),
      'GET',
      '/api/workspaces/w1/backlog?epicId=e1',
      undefined,
    ],
    [
      'createWorkItem',
      () =>
        service.createWorkItem('w1', {
          kind: 'Task',
          title: 'Buy tablets',
          description: '',
          parentId: 's1',
          assigneeId: null,
          storyPoints: null,
        }),
      'POST',
      '/api/workspaces/w1/items',
      {
        kind: 'Task',
        title: 'Buy tablets',
        description: '',
        parentId: 's1',
        assigneeId: null,
        storyPoints: null,
      },
    ],
    ['getWorkItem', () => service.getWorkItem('i1'), 'GET', '/api/items/i1', undefined],
    [
      'updateWorkItem',
      () =>
        service.updateWorkItem('i1', {
          title: 'T',
          description: '',
          assigneeId: null,
          storyPoints: 3,
          status: 'Done',
        }),
      'PUT',
      '/api/items/i1',
      { title: 'T', description: '', assigneeId: null, storyPoints: 3, status: 'Done' },
    ],
    [
      'setTaskDone',
      () => service.setTaskDone('t1', true),
      'PUT',
      '/api/items/t1/done',
      { done: true },
    ],
    [
      'addComment',
      () => service.addComment('i1', 'Hello'),
      'POST',
      '/api/items/i1/comments',
      { body: 'Hello' },
    ],
    ['getBoard', () => service.getBoard('w1'), 'GET', '/api/workspaces/w1/board', undefined],
    [
      'getBoard with no epic',
      () => service.getBoard('w1', { noEpic: true }),
      'GET',
      '/api/workspaces/w1/board?noEpic=true',
      undefined,
    ],
    [
      'moveCard',
      () => service.moveCard('i1', 'InProgress'),
      'PUT',
      '/api/items/i1/status',
      { status: 'InProgress' },
    ],
    ['getSprints', () => service.getSprints('w1'), 'GET', '/api/workspaces/w1/sprints', undefined],
    [
      'startSprint',
      () =>
        service.startSprint('w1', {
          name: 'Sprint 8',
          goal: 'G',
          startDate: '2026-11-03',
          endDate: '2026-11-14',
          storyIds: ['s1'],
        }),
      'POST',
      '/api/workspaces/w1/sprints',
      {
        name: 'Sprint 8',
        goal: 'G',
        startDate: '2026-11-03',
        endDate: '2026-11-14',
        storyIds: ['s1'],
      },
    ],
    [
      'addStoriesToSprint',
      () => service.addStoriesToSprint('w1', 'sp1', ['s1']),
      'POST',
      '/api/workspaces/w1/sprints/sp1/stories',
      { storyIds: ['s1'] },
    ],
    [
      'closeSprint',
      () => service.closeSprint('w1', 'sp1'),
      'POST',
      '/api/workspaces/w1/sprints/sp1/close',
      null,
    ],
  ])('%s', (_name, call, method, url, body) => {
    (call() as Observable<unknown>).subscribe();

    const req = controller.expectOne((r) => r.urlWithParams === url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush(null);
  });
});
