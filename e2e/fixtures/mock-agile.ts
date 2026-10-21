import { Route, WebSocketRoute } from '@playwright/test';

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
  committedPoints: number | null;
}

export type MockKind = 'Initiative' | 'Epic' | 'Story' | 'Task';
export type MockStatus = 'ToDo' | 'InProgress' | 'Done';

export interface MockComment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface MockItem {
  id: string;
  workspaceId: string;
  kind: MockKind;
  title: string;
  description: string;
  status: MockStatus;
  isDone: boolean;
  assigneeId: string | null;
  parentId: string | null;
  sprintId: string | null;
  storyPoints: number | null;
  isArchived: boolean;
  comments: MockComment[];
}

const PARENT_OF: Record<MockKind, MockKind | null> = {
  Initiative: null,
  Epic: 'Initiative',
  Story: 'Epic',
  Task: 'Story',
};
const PARENT_PROBLEM: Record<MockKind, string> = {
  Initiative: 'An initiative has no parent.',
  Epic: 'An epic sits only under an initiative.',
  Story: 'A story sits only under an epic.',
  Task: 'A task must belong to a story.',
};
const KIND_ORDER: MockKind[] = ['Initiative', 'Epic', 'Story', 'Task'];

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
  readonly items: MockItem[] = [];
  private comments = 0;

  /** Open hub connections and the groups each joined, as AgileHub keeps them. */
  private readonly sockets = new Set<{
    ws: WebSocketRoute;
    caller: MockAccount;
    groups: Set<string>;
  }>();

  constructor(
    private readonly profiles: Map<string, MockProfile>,
    /** MockApi's list of requests nobody implements; the fixture fails the test on any. */
    private readonly unrecognised: string[],
    /** Who the hub connection belongs to: the account signed in when it opens. */
    private readonly signedIn: () => MockAccount | null,
  ) {}

  /** POST /hubs/agile/negotiate: offer WebSockets only, as the SignalR client asks. */
  negotiate(route: Route) {
    return route.fulfill({
      status: 200,
      json: {
        negotiateVersion: 1,
        connectionId: `connection-${this.sockets.size + 1}`,
        connectionToken: `token-${this.sockets.size + 1}`,
        availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }],
      },
    });
  }

  /** Plays AgileHub over the SignalR JSON protocol: the handshake, WatchBoard, and pushes to groups. */
  hub(ws: WebSocketRoute): void {
    const caller = this.signedIn();
    if (!caller) {
      void ws.close({ code: 1008 });
      return;
    }
    const connection = { ws, caller, groups: new Set<string>() };
    this.sockets.add(connection);
    ws.onClose(() => this.sockets.delete(connection));
    ws.onMessage((raw) => {
      for (const frame of String(raw).split('\u001e').filter(Boolean)) {
        const message = JSON.parse(frame) as {
          type?: number;
          invocationId?: string;
          target?: string;
          arguments?: unknown[];
        };
        if (message.type === undefined) {
          ws.send('{}\u001e');
          continue;
        }
        if (message.type !== 1) continue;
        const [id] = (message.arguments ?? []) as string[];
        const workspace = this.workspaces.find((w) => w.id === id && !w.isArchived);
        const allowed = workspace && this.access(workspace, caller) !== 'Outsider';
        if (message.target === 'WatchBoard' && allowed) {
          connection.groups.add(`board:${id}`);
          ws.send(
            JSON.stringify({ type: 3, invocationId: message.invocationId, result: null }) +
              '\u001e',
          );
        } else {
          ws.send(
            JSON.stringify({
              type: 3,
              invocationId: message.invocationId,
              error: 'You’re not a member of this workspace.',
            }) + '\u001e',
          );
        }
      }
    });
  }

  /** How many open connections watch a workspace's board. */
  boardWatchers(workspaceId: string): number {
    return [...this.sockets].filter((c) => c.groups.has(`board:${workspaceId}`)).length;
  }

  /** Someone else moved a card: tell every board watching the workspace, as SignalRAgileNotifier does. */
  cardMoved(itemId: string, status: MockStatus): void {
    const item = this.items.find((i) => i.id === itemId)!;
    item.status = status;
    this.push(`board:${item.workspaceId}`, 'CardMoved', [itemId, status]);
  }

  private push(group: string, target: string, args: unknown[]): void {
    for (const { ws, groups } of this.sockets) {
      if (groups.has(group))
        ws.send(JSON.stringify({ type: 1, target, arguments: args }) + '\u001e');
    }
  }

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
      committedPoints: null,
      ...sprint,
    };
    this.sprints.push(full);
    return full;
  }

  addItem(
    item: Partial<MockItem> & { workspaceId: string; kind: MockKind; title: string },
  ): MockItem {
    const full: MockItem = {
      id: `item-${this.items.length + 1}`,
      description: '',
      status: 'ToDo',
      isDone: false,
      assigneeId: null,
      parentId: null,
      sprintId: null,
      storyPoints: null,
      isArchived: false,
      comments: [],
      ...item,
    };
    this.items.push(full);
    return full;
  }

  addComment(itemId: string, authorId: string, body: string, createdAt: string): void {
    this.items
      .find((i) => i.id === itemId)!
      .comments.push({ id: `comment-${++this.comments}`, authorId, body, createdAt });
  }

  /** Answers the request when it is an Agile route; returns false otherwise. */
  handles(path: string): boolean {
    return path.startsWith('/api/workspaces') || path.startsWith('/api/items');
  }

  async handle(request: AgileRequest): Promise<void> {
    const { route, method, path, caller } = request;
    if (!caller) return route.fulfill({ status: 401 });

    const itemRoute = /^\/api\/items\/([^/]+)(\/.*)?$/.exec(path);
    if (itemRoute) return this.itemRequest(request, itemRoute[1], itemRoute[2] ?? '');

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
      case 'PUT /method': {
        if (!manage) return route.fulfill({ status: 403 });
        const target = request.body['method'] as MockMethod;
        if (target === workspace.method) return problem(route, 409, `This workspace already uses ${target}.`);
        const open = this.sprints.filter((sp) => sp.workspaceId === workspace.id && sp.state !== 'Closed');
        if (target === 'Kanban') open.forEach((sp) => this.close(sp));
        else {
          for (const st of this.items.filter((i) => i.workspaceId === workspace.id && i.kind === 'Story' && i.status !== 'Done')) {
            st.sprintId = null;
          }
        }
        workspace.method = target;
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
      case 'GET /backlog':
        return route.fulfill({ status: 200, json: this.backlog(workspace, request.url) });
      case 'GET /board':
        return route.fulfill({ status: 200, json: this.board(workspace, request.url) });
      case 'GET /sprints':
        return route.fulfill({ status: 200, json: this.sprintsDto(workspace) });
      case 'POST /sprints':
        return this.startSprint(request, workspace, manage);
      case 'POST /items':
        return this.createItem(request, workspace, access);
    }

    const sprintAction = /^\/sprints\/([^/]+)\/(stories|close)$/.exec(rest);
    if (method === 'POST' && sprintAction) {
      const sprint = this.sprints.find(
        (sp) => sp.id === sprintAction[1] && sp.workspaceId === workspace.id,
      );
      if (!sprint) return route.fulfill({ status: 404 });
      if (sprintAction[2] === 'stories') {
        if (access === 'Staff') return route.fulfill({ status: 403 });
        for (const id of (request.body['storyIds'] as string[]) ?? [])
          this.items.find((i) => i.id === id)!.sprintId = sprint.id;
        return route.fulfill({ status: 204 });
      }
      if (!manage) return route.fulfill({ status: 403 });
      this.close(sprint);
      return route.fulfill({ status: 204 });
    }

    const member = /^\/members\/([^/]+)$/.exec(rest);
    if (method === 'DELETE' && member) {
      if (!manage) return route.fulfill({ status: 403 });
      if (member[1] === workspace.ownerId) {
        return problem(route, 409, 'The owner can’t be removed from their workspace.');
      }
      workspace.memberIds = workspace.memberIds.filter((id) => id !== member[1]);
      for (const item of this.items.filter(
        (i) => i.workspaceId === workspace.id && i.assigneeId === member[1],
      )) {
        item.assigneeId = null;
      }
      return route.fulfill({ status: 204 });
    }
    return this.unknown(request);
  }

  private createItem(
    { route, body, caller }: AgileRequest,
    workspace: MockWorkspace,
    access: MockAccess,
  ) {
    const kind = body['kind'] as MockKind;
    const planning = kind === 'Initiative' || kind === 'Epic';
    if (access === 'Staff' || (planning && access === 'Member'))
      return route.fulfill({ status: 403 });
    const title = String(body['title'] ?? '').trim();
    if (!title) return invalid(route, 'Title', 'Give it a title.');
    if (title.length > 200)
      return invalid(route, 'Title', 'Use 200 characters or fewer for the title.');
    const parentId = (body['parentId'] as string | null) ?? null;
    const parent = this.live(parentId);
    const wanted = PARENT_OF[kind];
    if (
      (kind === 'Task' && !parent) ||
      (parent && (parent.kind !== wanted || parent.workspaceId !== workspace.id))
    ) {
      return invalid(route, 'ParentId', PARENT_PROBLEM[kind]);
    }
    const assigneeId = (body['assigneeId'] as string | null) ?? null;
    if (assigneeId && !this.isMember(workspace, assigneeId)) {
      return invalid(route, 'AssigneeId', 'Choose someone in this workspace.');
    }
    const item = this.addItem({
      workspaceId: workspace.id,
      kind,
      title,
      description: String(body['description'] ?? '').trim(),
      parentId,
      assigneeId,
      storyPoints: kind === 'Story' ? ((body['storyPoints'] as number | null) ?? null) : null,
    });
    return route.fulfill({ status: 201, json: this.itemDto(item, caller!) });
  }

  private async itemRequest(request: AgileRequest, id: string, rest: string) {
    const { route, method, body, caller } = request;
    const item = this.live(id);
    const workspace =
      item && this.workspaces.find((w) => w.id === item.workspaceId && !w.isArchived);
    const access = workspace ? this.access(workspace, caller!) : 'Outsider';
    if (!item || !workspace || access === 'Outsider') return route.fulfill({ status: 404 });
    const planning = item.kind === 'Initiative' || item.kind === 'Epic';
    const canEdit = access !== 'Staff' && !(planning && access === 'Member');

    switch (`${method} ${rest}`) {
      case 'GET ':
        return route.fulfill({ status: 200, json: this.itemDto(item, caller!) });
      case 'PUT ': {
        if (!canEdit) return route.fulfill({ status: 403 });
        const title = String(body['title'] ?? '').trim();
        if (!title) return invalid(route, 'Title', 'Give it a title.');
        const assigneeId = (body['assigneeId'] as string | null) ?? null;
        if (assigneeId && !this.isMember(workspace, assigneeId)) {
          return invalid(route, 'AssigneeId', 'Choose someone in this workspace.');
        }
        item.title = title;
        item.description = String(body['description'] ?? '').trim();
        item.assigneeId = assigneeId;
        if (item.kind === 'Story')
          item.storyPoints = (body['storyPoints'] as number | null) ?? null;
        if (item.kind !== 'Task' && body['status']) item.status = body['status'] as MockStatus;
        return route.fulfill({ status: 204 });
      }
      case 'PUT /status': {
        if (!canEdit) return route.fulfill({ status: 403 });
        if (item.kind === 'Task')
          return problem(route, 409, 'A task is ticked off on its story, not moved on the board.');
        item.status = body['status'] as MockStatus;
        this.push(`board:${item.workspaceId}`, 'CardMoved', [item.id, item.status]);
        return route.fulfill({ status: 204 });
      }
      case 'PUT /done':
        if (access === 'Staff') return route.fulfill({ status: 403 });
        item.isDone = Boolean(body['done']);
        return route.fulfill({ status: 204 });
      case 'POST /comments': {
        if (access === 'Staff') return route.fulfill({ status: 403 });
        const text = String(body['body'] ?? '').trim();
        if (!text) return invalid(route, 'Body', 'Write a comment first.');
        const createdAt = new Date(Date.UTC(2026, 9, 21, 12, ++this.comments)).toISOString();
        item.comments.push({
          id: `comment-${this.comments}`,
          authorId: caller!.profileId,
          body: text,
          createdAt,
        });
        return route.fulfill({
          status: 201,
          json: {
            id: `comment-${this.comments}`,
            authorId: caller!.profileId,
            authorName: this.nameOf(caller!.profileId),
            body: text,
            createdAt,
          },
        });
      }
    }
    return this.unknown(request);
  }

  itemDto(item: MockItem, caller: MockAccount) {
    const workspace = this.workspaces.find((w) => w.id === item.workspaceId)!;
    const access = this.access(workspace, caller);
    const planning = item.kind === 'Initiative' || item.kind === 'Epic';
    const parent = this.live(item.parentId);
    const grandparent = this.live(parent?.parentId ?? null);
    const ref = (i: MockItem | undefined) =>
      i ? { id: i.id, kind: i.kind, title: i.title } : null;
    const sprint = this.sprints.find((s) => s.id === item.sprintId);
    return {
      id: item.id,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      kind: item.kind,
      title: item.title,
      description: item.description,
      status: item.status,
      isDone: item.isDone,
      assigneeId: item.assigneeId,
      assigneeName: item.assigneeId ? this.nameOf(item.assigneeId) : null,
      storyPoints: item.storyPoints,
      parent: ref(parent),
      grandparent: ref(grandparent),
      sprint: sprint ? { id: sprint.id, name: sprint.name, state: sprint.state } : null,
      tasks: this.children(item.id)
        .filter((t) => t.kind === 'Task')
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((t) => ({
          id: t.id,
          title: t.title,
          isDone: t.isDone,
          assigneeId: t.assigneeId,
          assigneeName: t.assigneeId ? this.nameOf(t.assigneeId) : null,
        })),
      comments: [...item.comments]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((c) => ({ ...c, authorName: this.nameOf(c.authorId) })),
      canEdit: access !== 'Staff' && !(planning && access === 'Member'),
      canManage: access === 'Owner' || access === 'Admin',
    };
  }

  private backlog(workspace: MockWorkspace, url: URL) {
    const items = this.items.filter((i) => i.workspaceId === workspace.id && !i.isArchived);
    const node = (i: MockItem): unknown => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      status: i.status,
      isDone: i.isDone,
      storyPoints: i.storyPoints,
      assigneeId: i.assigneeId,
      assigneeName: i.assigneeId ? this.nameOf(i.assigneeId) : null,
      sprintId: i.sprintId,
      children: ordered(this.children(i.id)).map(node),
    });
    let roots = items.filter((i) => !i.parentId || !this.live(i.parentId));
    const initiativeId = url.searchParams.get('initiativeId');
    const epicId = url.searchParams.get('epicId');
    if (initiativeId) roots = items.filter((i) => i.id === initiativeId);
    else if (epicId) roots = items.filter((i) => i.id === epicId);
    else if (url.searchParams.get('noEpic') === 'true')
      roots = roots.filter((i) => i.kind === 'Story');
    return ordered(roots.filter((i) => i.kind !== 'Task')).map(node);
  }

  private assigned(workspace: MockWorkspace, profileId: string, tasks: boolean): number {
    return this.items.filter(
      (i) =>
        i.workspaceId === workspace.id &&
        i.assigneeId === profileId &&
        (i.kind === 'Task') === tasks,
    ).length;
  }

  private sprintStories(sprint: MockSprint): MockItem[] {
    return this.items.filter(
      (i) => i.sprintId === sprint.id && i.kind === 'Story' && !i.isArchived,
    );
  }

  private close(sprint: MockSprint): void {
    const stories = this.sprintStories(sprint);
    const points = (list: MockItem[]) => list.reduce((n, st) => n + (st.storyPoints ?? 0), 0);
    sprint.completedPoints = points(stories.filter((st) => st.status === 'Done'));
    sprint.committedPoints = points(stories);
    for (const st of stories.filter((x) => x.status !== 'Done')) st.sprintId = null;
    sprint.state = 'Closed';
  }

  private sprintsDto(workspace: MockWorkspace) {
    const mine = this.sprints.filter((sp) => sp.workspaceId === workspace.id);
    const active = mine.find((sp) => sp.state === 'Active') ?? null;
    const history = mine
      .filter((sp) => sp.state === 'Closed')
      .sort((a, b) => b.endDate.localeCompare(a.endDate));
    const dto = (sp: MockSprint) => {
      const stories = this.sprintStories(sp);
      return {
        ...sp,
        storyCount: stories.length,
        points: stories.reduce((n, st) => n + (st.storyPoints ?? 0), 0),
      };
    };
    const candidates = this.items
      .filter(
        (i) =>
          i.workspaceId === workspace.id &&
          i.kind === 'Story' &&
          !i.isArchived &&
          i.status !== 'Done' &&
          (!i.sprintId || i.sprintId === active?.id),
      )
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((i) => ({
        id: i.id,
        title: i.title,
        storyPoints: i.storyPoints,
        status: i.status,
        returnedFrom: i.sprintId ? active!.name : null,
      }));
    return {
      active: active ? dto(active) : null,
      history: history.map(dto),
      averageCompletedPoints: history.length
        ? Math.round(history.reduce((n, sp) => n + (sp.completedPoints ?? 0), 0) / history.length)
        : null,
      candidates,
    };
  }

  private startSprint({ route, body }: AgileRequest, workspace: MockWorkspace, manage: boolean) {
    if (!manage) return route.fulfill({ status: 403 });
    if (workspace.method !== 'Scrum')
      return problem(route, 409, 'Sprints run only in a Scrum workspace.');
    const goal = String(body['goal'] ?? '').trim();
    if (!goal)
      return invalid(route, 'Goal', 'Write a goal so the team knows what done looks like.');
    const storyIds = (body['storyIds'] as string[] | undefined) ?? [];
    if (!storyIds.length) return invalid(route, 'StoryIds', 'Choose at least one story.');
    if (String(body['endDate']) <= String(body['startDate'])) {
      return invalid(route, 'EndDate', 'Choose an end date after the start date.');
    }
    const active = this.sprints.find(
      (sp) => sp.workspaceId === workspace.id && sp.state === 'Active',
    );
    if (active) this.close(active);
    const sprint = this.addSprint({
      workspaceId: workspace.id,
      name: String(body['name']).trim(),
      goal,
      startDate: String(body['startDate']),
      endDate: String(body['endDate']),
      state: 'Active',
    });
    for (const id of storyIds) this.items.find((i) => i.id === id)!.sprintId = sprint.id;
    return route.fulfill({ status: 201, json: { id: sprint.id } });
  }

  private board(workspace: MockWorkspace, url: URL) {
    const sprint = this.sprints.find(
      (sp) => sp.workspaceId === workspace.id && sp.state === 'Active',
    );
    let stories = this.items.filter(
      (i) => i.workspaceId === workspace.id && i.kind === 'Story' && !i.isArchived,
    );
    if (workspace.method === 'Scrum') {
      stories = sprint ? stories.filter((st) => st.sprintId === sprint.id) : [];
    } else if (url.searchParams.get('epicId')) {
      stories = stories.filter((st) => st.parentId === url.searchParams.get('epicId'));
    } else if (url.searchParams.get('initiativeId')) {
      const epics = this.children(url.searchParams.get('initiativeId')!).map((e) => e.id);
      stories = stories.filter((st) => st.parentId && epics.includes(st.parentId));
    } else if (url.searchParams.get('noEpic') === 'true') {
      stories = stories.filter((st) => !st.parentId);
    }
    stories.sort((a, b) => a.title.localeCompare(b.title));
    const card = (st: MockItem) => {
      const tasks = this.children(st.id).filter((t) => t.kind === 'Task');
      return {
        id: st.id,
        title: st.title,
        assigneeId: st.assigneeId,
        assigneeName: st.assigneeId ? this.nameOf(st.assigneeId) : null,
        storyPoints: st.storyPoints,
        tasksDone: tasks.filter((t) => t.isDone).length,
        tasksTotal: tasks.length,
      };
    };
    const points = (list: MockItem[]) => list.reduce((n, st) => n + (st.storyPoints ?? 0), 0);
    return {
      method: workspace.method,
      sprint: sprint
        ? {
            id: sprint.id,
            name: sprint.name,
            goal: sprint.goal,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
            completedPoints: points(stories.filter((st) => st.status === 'Done')),
            totalPoints: points(stories),
          }
        : null,
      columns: (['ToDo', 'InProgress', 'Done'] as MockStatus[]).map((status) => ({
        status,
        cards: stories.filter((st) => st.status === status).map(card),
      })),
    };
  }

  private children(id: string): MockItem[] {
    return this.items.filter((i) => i.parentId === id && !i.isArchived);
  }

  private live(id: string | null): MockItem | undefined {
    return id ? this.items.find((i) => i.id === id && !i.isArchived) : undefined;
  }

  private isMember(workspace: MockWorkspace, profileId: string): boolean {
    return workspace.ownerId === profileId || workspace.memberIds.includes(profileId);
  }

  private nameOf(profileId: string): string {
    return this.profiles.get(profileId)?.name ?? 'A former member';
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
        assignedStories: this.assigned(workspace, id, false),
        assignedTasks: this.assigned(workspace, id, true),
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

function ordered(items: MockItem[]): MockItem[] {
  return [...items].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.title.localeCompare(b.title),
  );
}

function invalid(route: Route, field: string, message: string) {
  return route.fulfill({ status: 400, json: { status: 400, errors: { [field]: [message] } } });
}

function problem(route: Route, status: number, detail: string) {
  return route.fulfill({ status, json: { status, detail } });
}
