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
  /** Without an id: everyone a new workspace can include. With one: team members not in it yet. */
  listMemberCandidates(workspaceId?: string): Observable<MemberCandidateDto[]>;
  addMembers(workspaceId: string, profileIds: string[]): Observable<void>;
  removeMember(workspaceId: string, profileId: string): Observable<void>;
}

export const AGILE_SERVICE = new InjectionToken<AgileService>('AGILE_SERVICE');
