import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import {
  AgileService,
  CreateWorkspaceRequest,
  MemberCandidateDto,
  WorkspaceDto,
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

  private workspace(id: string): string {
    return `${this.base}/workspaces/${encodeURIComponent(id)}`;
  }
}
