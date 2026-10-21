import { Route } from '@playwright/test';

import type { MockAccount, MockProfile } from './mock-api';

export type MockMethod = 'Scrum' | 'Kanban';
export type MockAccess = 'Owner' | 'Member' | 'Admin' | 'Staff' | 'Outsider';

export interface MockWorkspace {
  id: string;
  name: string;
  method: MockMethod;
  ownerId: string;
  memberIds: string[];
  isArchived: boolean;
}

export interface MockSprint {
  id: string;
  workspaceId: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  state: 'Planned' | 'Active' | 'Closed';
  completedPoints: number | null;
}

const TEAM_ROLES = ['CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead', 'Volunteer'];

/** The request the agile fake answers, already parsed by MockApi. */
export interface AgileRequest {
  route: Route;
  method: string;
  path: string;
  url: URL;
  body: Record<string, unknown>;
  caller: MockAccount | null;
}

/**
 * Plays the Agile API (backend/src/FaithTech.Community.Api/Endpoints/WorkspacesEndpoints.cs and friends) with
 * the same access rules: owner, member, Staff read-only, System Admin override, outsider 404 (ADR 0008).
 */
export class MockAgile {
  readonly workspaces: MockWorkspace[] = [];
  readonly sprints: MockSprint[] = [];

  constructor(
    private readonly profiles: Map<string, MockProfile>,
    /** MockApi's list of requests nobody implements; the fixture fails the test on any. */
    private readonly unrecognised: string[],
  ) {}

  addWorkspace(
    workspace: Partial<MockWorkspace> & { name: string; ownerId: string },
  ): MockWorkspace {
    const full: MockWorkspace = {
      id: `workspace-${this.workspaces.length + 1}`,
      method: 'Scrum',
      memberIds: [],
      isArchived: false,
      ...workspace,
    };
    this.workspaces.push(full);
    return full;
  }

  addSprint(sprint: Partial<MockSprint> & { workspaceId: string; name: string }): MockSprint {
    const full: MockSprint = {
      id: `sprint-${this.sprints.length + 1}`,
      goal: 'Hackathon ready for registration',
      startDate: '2026-10-20',
      endDate: '2026-10-31',
      state: 'Planned',
      completedPoints: null,
      ...sprint,
    };
    this.sprints.push(full);
    return full;
  }

  /** Answers the request when it is an Agile route; returns false otherwise. */
  handles(path: string): boolean {
    return path.startsWith('/api/workspaces');
  }

  async handle(request: AgileRequest): Promise<void> {
    const { route, method, path, caller } = request;
    if (!caller) return route.fulfill({ status: 401 });

    if (path === '/api/workspaces') {
      if (method === 'GET') return this.list(request);
      if (method === 'POST') return this.create(request);
    }
    if (method === 'GET' && path === '/api/workspaces/candidates') {
      if (!this.isLeadOrAdmin(caller)) return route.fulfill({ status: 403 });
      return route.fulfill({ status: 200, json: this.candidates([caller.profileId]) });
    }

    const match = /^\/api\/workspaces\/([^/]+)(\/.*)?$/.exec(path);
    if (!match) return this.unknown(request);
    const workspace = this.workspaces.find((w) => w.id === match[1] && !w.isArchived);
    const access = workspace ? this.access(workspace, caller) : 'Outsider';
    if (!workspace || access === 'Outsider') return route.fulfill({ status: 404 });
    const rest = match[2] ?? '';
    const manage = access === 'Owner' || access === 'Admin';

    switch (`${method} ${rest}`) {
      case 'GET ':
        return route.fulfill({ status: 200, json: this.detail(workspace, caller) });
      case 'PUT ': {
        if (!manage) return route.fulfill({ status: 403 });
        const name = String(request.body['name'] ?? '').trim();
        if (!name)
          return invalid(route, 'Name', 'Give the workspace a name your team will recognise.');
        workspace.name = name;
        return route.fulfill({ status: 204 });
      }
      case 'GET /candidates':
        if (!manage) return route.fulfill({ status: 403 });
        return route.fulfill({
          status: 200,
          json: this.candidates([workspace.ownerId, ...workspace.memberIds]),
        });
      case 'POST /members': {
        if (!manage) return route.fulfill({ status: 403 });
        const ids = (request.body['profileIds'] as string[] | undefined) ?? [];
        if (!ids.length) return invalid(route, 'ProfileIds', 'Choose at least one person.');
        if (!ids.every((id) => this.onTeam(id))) {
          return invalid(
            route,
            'ProfileIds',
            'Only people with a lead or volunteer role can be added.',
          );
        }
        workspace.memberIds.push(...ids.filter((id) => !workspace.memberIds.includes(id)));
        return route.fulfill({ status: 204 });
      }
    }

    const member = /^\/members\/([^/]+)$/.exec(rest);
    if (method === 'DELETE' && member) {
      if (!manage) return route.fulfill({ status: 403 });
      if (member[1] === workspace.ownerId) {
        return problem(route, 409, 'The owner can’t be removed from their workspace.');
      }
      workspace.memberIds = workspace.memberIds.filter((id) => id !== member[1]);
      return route.fulfill({ status: 204 });
    }
    return this.unknown(request);
  }

  access(workspace: MockWorkspace, caller: MockAccount): MockAccess {
    if (workspace.ownerId === caller.profileId) return 'Owner';
    if (workspace.memberIds.includes(caller.profileId)) return 'Member';
    if (caller.roles.includes('SystemAdmin')) return 'Admin';
    if (caller.roles.includes('Staff')) return 'Staff';
    return 'Outsider';
  }

  private list({ route, caller }: AgileRequest) {
    const all = caller!.roles.some((r) => r === 'Staff' || r === 'SystemAdmin');
    const visible = this.workspaces
      .filter((w) =>
        w.isArchived
          ? w.ownerId === caller!.profileId
          : all || this.access(w, caller!) !== 'Outsider',
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    return route.fulfill({ status: 200, json: visible.map((w) => this.summary(w, caller!)) });
  }

  private create({ route, body, caller }: AgileRequest) {
    if (!this.isLeadOrAdmin(caller!)) return route.fulfill({ status: 403 });
    const name = String(body['name'] ?? '').trim();
    if (!name) return invalid(route, 'Name', 'Give the workspace a name.');
    const memberIds = (body['memberIds'] as string[] | undefined) ?? [];
    if (!memberIds.every((id) => this.onTeam(id))) {
      return invalid(route, 'MemberIds', 'Only people with a lead or volunteer role can be added.');
    }
    const workspace = this.addWorkspace({
      name,
      method: body['method'] as MockMethod,
      ownerId: caller!.profileId,
      memberIds,
    });
    return route.fulfill({ status: 201, json: this.detail(workspace, caller!) });
  }

  summary(workspace: MockWorkspace, caller: MockAccount) {
    const owner = this.profiles.get(workspace.ownerId);
    return {
      id: workspace.id,
      name: workspace.name,
      method: workspace.method,
      ownerId: workspace.ownerId,
      ownerName: owner?.name ?? 'A former member',
      isOwner: workspace.ownerId === caller.profileId,
      activeSprintName:
        this.sprints.find((s) => s.workspaceId === workspace.id && s.state === 'Active')?.name ??
        null,
      memberCount: new Set([workspace.ownerId, ...workspace.memberIds]).size,
      isArchived: workspace.isArchived,
      needsNewOwner: !owner?.roles.some((r) => r === 'CityLead' || r === 'SystemAdmin'),
    };
  }

  detail(workspace: MockWorkspace, caller: MockAccount) {
    const access = this.access(workspace, caller);
    const ids = [
      workspace.ownerId,
      ...workspace.memberIds.filter((id) => id !== workspace.ownerId),
    ];
    const members = ids
      .map((id) => ({
        profileId: id,
        name: this.profiles.get(id)?.name ?? 'A former member',
        roles: this.profiles.get(id)?.roles ?? [],
        isOwner: id === workspace.ownerId,
        assignedStories: 0,
        assignedTasks: 0,
      }))
      .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.name.localeCompare(b.name));
    const summary = this.summary(workspace, caller);
    return {
      id: workspace.id,
      name: workspace.name,
      method: workspace.method,
      ownerId: workspace.ownerId,
      ownerName: summary.ownerName,
      members,
      isArchived: workspace.isArchived,
      access,
      canEdit: access !== 'Staff',
      canManage: access === 'Owner' || access === 'Admin',
      needsNewOwner: summary.needsNewOwner,
    };
  }

  private candidates(excluded: string[]) {
    return [...this.profiles.values()]
      .filter((p) => !excluded.includes(p.id) && this.onTeam(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ profileId: p.id, name: p.name, roles: p.roles }));
  }

  private onTeam(profileId: string): boolean {
    return this.profiles.get(profileId)?.roles.some((r) => TEAM_ROLES.includes(r)) ?? false;
  }

  private isLeadOrAdmin(caller: MockAccount): boolean {
    return caller.roles.includes('CityLead') || caller.roles.includes('SystemAdmin');
  }

  private unknown({ route, method, path }: AgileRequest) {
    this.unrecognised.push(`${method} ${path}`);
    return route.abort('failed');
  }
}

function invalid(route: Route, field: string, message: string) {
  return route.fulfill({ status: 400, json: { status: 400, errors: { [field]: [message] } } });
}

function problem(route: Route, status: number, detail: string) {
  return route.fulfill({ status, json: { status, detail } });
}
