import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Role } from '../shared';

export type WorkspaceMethod = 'Scrum' | 'Kanban';

/** How the caller relates to a workspace (ADR 0008). */
export type WorkspaceAccess = 'Owner' | 'Member' | 'Admin' | 'Staff';

/** A row on the workspaces page (L2-050). */
export interface WorkspaceSummaryDto {
  id: string;
  name: string;
  method: WorkspaceMethod;
  ownerId: string;
  ownerName: string;
  isOwner: boolean;
  activeSprintName: string | null;
  /** The owner and every member. */
  memberCount: number;
  /** Listed only to the owner and System Admin, so they can restore it. */
  isArchived: boolean;
  /** The owner no longer holds City Lead; System Admin reassigns it (L2-037 AC2). */
  needsNewOwner: boolean;
}

export interface WorkspaceMemberDto {
  profileId: string;
  name: string;
  roles: Role[];
  isOwner: boolean;
  /** Stories and tasks assigned to them, which removing them unassigns (L2-031 AC8). */
  assignedStories: number;
  assignedTasks: number;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  method: WorkspaceMethod;
  ownerId: string;
  ownerName: string;
  /** The owner first, then by name. */
  members: WorkspaceMemberDto[];
  isArchived: boolean;
  access: WorkspaceAccess;
  /** Stories, tasks, comments, card moves and Planning Poker. */
  canEdit: boolean;
  /** Initiatives and epics, members, settings, sprints, method and archive. */
  canManage: boolean;
  needsNewOwner: boolean;
}

/** A profile holding a lead or volunteer role, who can join a workspace. */
export interface MemberCandidateDto {
  profileId: string;
  name: string;
  roles: Role[];
}

export type WorkItemKind = 'Initiative' | 'Epic' | 'Story' | 'Task';
export type WorkItemStatus = 'ToDo' | 'InProgress' | 'Done';

export interface WorkItemRefDto {
  id: string;
  kind: WorkItemKind;
  title: string;
}

export interface TaskDto {
  id: string;
  title: string;
  isDone: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
}

export interface CommentDto {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SprintRefDto {
  id: string;
  name: string;
  state: 'Planned' | 'Active' | 'Closed';
}

/** One work item on its page (L2-033). */
export interface WorkItemDto {
  id: string;
  workspaceId: string;
  workspaceName: string;
  kind: WorkItemKind;
  title: string;
  description: string;
  /** Initiatives, epics and stories; tasks use `isDone`. */
  status: WorkItemStatus;
  isDone: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  /** Stories only. */
  storyPoints: number | null;
  /** A story's epic, an epic's initiative, a task's story. */
  parent: WorkItemRefDto | null;
  /** A story's initiative, a task's epic. */
  grandparent: WorkItemRefDto | null;
  sprint: SprintRefDto | null;
  /** A story's tasks. */
  tasks: TaskDto[];
  /** Newest first. */
  comments: CommentDto[];
  /** May change this item's fields (members; only the owner for initiatives and epics). */
  canEdit: boolean;
  /** Owner or System Admin: archive. */
  canManage: boolean;
}

/** A node of the backlog tree (L2-032 AC4). */
export interface BacklogNodeDto {
  id: string;
  kind: WorkItemKind;
  title: string;
  status: WorkItemStatus;
  isDone: boolean;
  storyPoints: number | null;
  assigneeId: string | null;
  assigneeName: string | null;
  sprintId: string | null;
  children: BacklogNodeDto[];
}

/** One initiative's or epic's subtree, or the stories with no epic. */
export type BacklogFilter =
  { initiativeId: string } | { epicId: string } | { noEpic: true } | Record<string, never>;

export interface CreateWorkItemRequest {
  kind: WorkItemKind;
  title: string;
  description: string;
  parentId: string | null;
  assigneeId: string | null;
  storyPoints: number | null;
}

export interface UpdateWorkItemRequest {
  title: string;
  description: string;
  assigneeId: string | null;
  storyPoints: number | null;
  status: WorkItemStatus | null;
}

export interface BoardCardDto {
  id: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  storyPoints: number | null;
  tasksDone: number;
  tasksTotal: number;
}

export interface BoardColumnDto {
  status: WorkItemStatus;
  cards: BoardCardDto[];
}

/** The active sprint of a Scrum board; completed points count its Done stories so far. */
export interface BoardSprintDto {
  id: string;
  name: string;
  goal: string;
  /** ISO dates, e.g. 2026-10-20. */
  startDate: string;
  endDate: string;
  completedPoints: number;
  totalPoints: number;
}

/** The board (L2-034): To Do, In Progress and Done. A Scrum board shows only the active sprint. */
export interface BoardDto {
  method: WorkspaceMethod;
  /** Null for Kanban, or for Scrum with no sprint running. */
  sprint: BoardSprintDto | null;
  columns: BoardColumnDto[];
}

export type SprintState = 'Planned' | 'Active' | 'Closed';

export interface SprintDto {
  id: string;
  name: string;
  goal: string;
  /** ISO dates, e.g. 2026-10-20. */
  startDate: string;
  endDate: string;
  state: SprintState;
  /** Stories in the sprint now (a closed sprint keeps only its Done stories). */
  storyCount: number;
  points: number;
  /** Closed sprints: "completed N of M points". */
  completedPoints: number | null;
  committedPoints: number | null;
}

/** A story the next sprint can take: from the backlog, or unfinished in the active sprint. */
export interface SprintCandidateDto {
  id: string;
  title: string;
  storyPoints: number | null;
  status: WorkItemStatus;
  /** The active sprint it would come back from, e.g. "Sprint 7". */
  returnedFrom: string | null;
}

/** The sprints of a Scrum workspace (L2-035). */
export interface SprintsDto {
  active: SprintDto | null;
  /** Closed sprints, newest first. */
  history: SprintDto[];
  averageCompletedPoints: number | null;
  candidates: SprintCandidateDto[];
}

export interface StartSprintRequest {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  storyIds: string[];
}

export interface CreateWorkspaceRequest {
  name: string;
  method: WorkspaceMethod;
  memberIds: string[];
}

/**
 * Contract for the Agile API (L2-031 to L2-038, L2-050, L2-051). Pages depend on AGILE_SERVICE, never on
 * HttpAgileService. The server answers 404 for a workspace the caller may not see and 403 for a write
 * they may not make.
 */
export interface AgileService {
  listWorkspaces(): Observable<WorkspaceSummaryDto[]>;
  /** City Lead or System Admin. 400 per field. */
  createWorkspace(request: CreateWorkspaceRequest): Observable<WorkspaceDto>;
  getWorkspace(id: string): Observable<WorkspaceDto>;
  /** Owner or System Admin. 400 Name. */
  renameWorkspace(id: string, name: string): Observable<void>;
  /** Owner or System Admin (L2-036). 409 when it already uses that method. */
  switchMethod(id: string, method: WorkspaceMethod): Observable<void>;
  /** Without an id: everyone a new workspace can include. With one: team members not in it yet. */
  listMemberCandidates(workspaceId?: string): Observable<MemberCandidateDto[]>;
  addMembers(workspaceId: string, profileIds: string[]): Observable<void>;
  removeMember(workspaceId: string, profileId: string): Observable<void>;

  getBacklog(workspaceId: string, filter?: BacklogFilter): Observable<BacklogNodeDto[]>;
  /** 400 per field (Title, ParentId, AssigneeId); 403 when a member creates an initiative or epic. */
  createWorkItem(workspaceId: string, request: CreateWorkItemRequest): Observable<WorkItemDto>;
  getWorkItem(id: string): Observable<WorkItemDto>;
  updateWorkItem(id: string, request: UpdateWorkItemRequest): Observable<void>;
  /** Tasks only. */
  setTaskDone(id: string, done: boolean): Observable<void>;
  addComment(itemId: string, body: string): Observable<CommentDto>;

  /** A Kanban board can be narrowed like the backlog; a Scrum board ignores the filter. */
  getBoard(workspaceId: string, filter?: BacklogFilter): Observable<BoardDto>;
  /** Moves a story to a column; open viewers hear of it through AGILE_LIVE_SERVICE. */
  moveCard(itemId: string, status: WorkItemStatus): Observable<void>;

  getSprints(workspaceId: string): Observable<SprintsDto>;
  /** Owner or System Admin, Scrum only (409 otherwise). Closes the active sprint first. 400 per field. */
  startSprint(workspaceId: string, request: StartSprintRequest): Observable<void>;
  /** Any member: into the planned or active sprint. */
  addStoriesToSprint(workspaceId: string, sprintId: string, storyIds: string[]): Observable<void>;
  /** Owner or System Admin. Unfinished stories return to the backlog. */
  closeSprint(workspaceId: string, sprintId: string): Observable<void>;
}

export const AGILE_SERVICE = new InjectionToken<AgileService>('AGILE_SERVICE');
