import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN } from '../errors';
import { ProfileRole } from '../shared';
import { RolesService } from './roles.service';

@Injectable()
export class HttpRolesService implements RolesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/profiles`;
  // The role dialog shows a refusal itself rather than leaving for the forbidden page.
  private readonly context = new HttpContext().set(HANDLES_FORBIDDEN, true);

  addRole(profileId: string, roleId: string, chapterId?: string | null): Observable<ProfileRole[]> {
    return this.http.post<ProfileRole[]>(
      `${this.base}/${encodeURIComponent(profileId)}/roles`,
      chapterId ? { roleId, chapterId } : { roleId },
      { context: this.context },
    );
  }

  removeRole(
    profileId: string,
    roleId: string,
    chapterId?: string | null,
  ): Observable<ProfileRole[]> {
    const params: Record<string, string> = chapterId ? { chapterId } : {};
    return this.http.delete<ProfileRole[]>(
      `${this.base}/${encodeURIComponent(profileId)}/roles/${encodeURIComponent(roleId)}`,
      { context: this.context, params },
    );
  }
}
