import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { toHttpParams } from '../shared';
import { TeamFilters, TeamListDto, TeamService } from './team.service';

@Injectable()
export class HttpTeamService implements TeamService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  list(filters: TeamFilters = {}, after?: string | null): Observable<TeamListDto> {
    return this.http.get<TeamListDto>(`${this.base}/team`, {
      params: toHttpParams({ role: filters.role, chapter: filters.chapterId, after }),
    });
  }
}
