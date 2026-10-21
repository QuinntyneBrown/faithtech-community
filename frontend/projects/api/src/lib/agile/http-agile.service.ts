import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import {
  AgileService,
  ArchivedItemDto,
  BacklogFilter,
  BacklogNodeDto,
  BoardDto,
  CommentDto,
  CreateWorkItemRequest,
  CreateWorkspaceRequest,
  MemberCandidateDto,
  SprintsDto,
  StartSprintRequest,
  UpdateWorkItemRequest,
  WorkItemDto,
  WorkItemStatus,
  WorkspaceDto,
  WorkspaceMethod,
  WorkspaceSummaryDto,
} from './agile.service';

@Injectable()
export class HttpAgileService implements AgileService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  listWorkspaces(): Observable<WorkspaceSummaryDto[]> {
    return this.http.get<WorkspaceSummaryDto[]>(`${this.base}/workspaces`);
  }

  createWorkspace(request: CreateWorkspaceRequest): Observable<WorkspaceDto> {
    return this.http.post<WorkspaceDto>(`${this.base}/workspaces`, request);
  }

  getWorkspace(id: string): Observable<WorkspaceDto> {
    return this.http.get<WorkspaceDto>(this.workspace(id));
  }

  renameWorkspace(id: string, name: string): Observable<void> {
    return this.http.put<void>(this.workspace(id), { name });
  }

  switchMethod(id: string, method: WorkspaceMethod): Observable<void> {
    return this.http.put<void>(`${this.workspace(id)}/method`, { method });
  }

  listMemberCandidates(workspaceId?: string): Observable<MemberCandidateDto[]> {
    const url = workspaceId
      ? `${this.workspace(workspaceId)}/candidates`
      : `${this.base}/workspaces/candidates`;
    return this.http.get<MemberCandidateDto[]>(url);
  }

  addMembers(workspaceId: string, profileIds: string[]): Observable<void> {
    return this.http.post<void>(`${this.workspace(workspaceId)}/members`, { profileIds });
  }

  removeMember(workspaceId: string, profileId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.workspace(workspaceId)}/members/${encodeURIComponent(profileId)}`,
    );
  }

  getBacklog(workspaceId: string, filter: BacklogFilter = {}): Observable<BacklogNodeDto[]> {
    const params = new HttpParams({ fromObject: filter as Record<string, string | boolean> });
    return this.http.get<BacklogNodeDto[]>(`${this.workspace(workspaceId)}/backlog`, { params });
  }

  createWorkItem(workspaceId: string, request: CreateWorkItemRequest): Observable<WorkItemDto> {
    return this.http.post<WorkItemDto>(`${this.workspace(workspaceId)}/items`, request);
  }

  getWorkItem(id: string): Observable<WorkItemDto> {
    return this.http.get<WorkItemDto>(this.item(id));
  }

  updateWorkItem(id: string, request: UpdateWorkItemRequest): Observable<void> {
    return this.http.put<void>(this.item(id), request);
  }

  setTaskDone(id: string, done: boolean): Observable<void> {
    return this.http.put<void>(`${this.item(id)}/done`, { done });
  }

  addComment(itemId: string, body: string): Observable<CommentDto> {
    return this.http.post<CommentDto>(`${this.item(itemId)}/comments`, { body });
  }

  getBoard(workspaceId: string, filter: BacklogFilter = {}): Observable<BoardDto> {
    const params = new HttpParams({ fromObject: filter as Record<string, string | boolean> });
    return this.http.get<BoardDto>(`${this.workspace(workspaceId)}/board`, { params });
  }

  moveCard(itemId: string, status: WorkItemStatus): Observable<void> {
    return this.http.put<void>(`${this.item(itemId)}/status`, { status });
  }

  getSprints(workspaceId: string): Observable<SprintsDto> {
    return this.http.get<SprintsDto>(`${this.workspace(workspaceId)}/sprints`);
  }

  startSprint(workspaceId: string, request: StartSprintRequest): Observable<void> {
    return this.http.post<void>(`${this.workspace(workspaceId)}/sprints`, request);
  }

  addStoriesToSprint(workspaceId: string, sprintId: string, storyIds: string[]): Observable<void> {
    return this.http.post<void>(
      `${this.workspace(workspaceId)}/sprints/${encodeURIComponent(sprintId)}/stories`,
      { storyIds },
    );
  }

  closeSprint(workspaceId: string, sprintId: string): Observable<void> {
    return this.http.post<void>(
      `${this.workspace(workspaceId)}/sprints/${encodeURIComponent(sprintId)}/close`,
      null,
    );
  }

  archiveWorkspace(id: string): Observable<void> {
    return this.http.post<void>(`${this.workspace(id)}/archive`, null);
  }

  restoreWorkspace(id: string): Observable<void> {
    return this.http.post<void>(`${this.workspace(id)}/restore`, null);
  }

  getArchivedItems(workspaceId: string): Observable<ArchivedItemDto[]> {
    return this.http.get<ArchivedItemDto[]>(`${this.workspace(workspaceId)}/archived-items`);
  }

  archiveWorkItem(id: string): Observable<void> {
    return this.http.post<void>(`${this.item(id)}/archive`, null);
  }

  restoreWorkItem(id: string): Observable<void> {
    return this.http.post<void>(`${this.item(id)}/restore`, null);
  }

  listOwnerCandidates(workspaceId: string): Observable<MemberCandidateDto[]> {
    return this.http.get<MemberCandidateDto[]>(`${this.workspace(workspaceId)}/owner-candidates`);
  }

  reassignOwner(workspaceId: string, ownerId: string): Observable<void> {
    return this.http.put<void>(`${this.workspace(workspaceId)}/owner`, { ownerId });
  }

  private item(id: string): string {
    return `${this.base}/items/${encodeURIComponent(id)}`;
  }

  private workspace(id: string): string {
    return `${this.base}/workspaces/${encodeURIComponent(id)}`;
  }
}
