import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import {
  CapabilityEntryDto,
  RoleDefinitionDto,
  RoleDefinitionRequest,
  RoleDefinitionsService,
} from './role-definitions.service';

@Injectable()
export class HttpRoleDefinitionsService implements RoleDefinitionsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  // A refusal or a failure reaches the dialog, which keeps the input, rather than an error page.
  private readonly writes = new HttpContext()
    .set(HANDLES_FORBIDDEN, true)
    .set(HANDLES_SERVER_ERROR, true);

  list(archived = false): Observable<RoleDefinitionDto[]> {
    const query = archived ? '?archived=true' : '';
    return this.http.get<RoleDefinitionDto[]>(`${this.base}/organisation/roles${query}`);
  }

  capabilities(): Observable<CapabilityEntryDto[]> {
    return this.http.get<CapabilityEntryDto[]>(`${this.base}/organisation/capabilities`);
  }

  define(request: RoleDefinitionRequest): Observable<RoleDefinitionDto> {
    return this.http.post<RoleDefinitionDto>(`${this.base}/organisation/roles`, request, {
      context: this.writes,
    });
  }

  update(id: string, request: RoleDefinitionRequest): Observable<RoleDefinitionDto> {
    return this.http.put<RoleDefinitionDto>(`${this.base}/organisation/roles/${id}`, request, {
      context: this.writes,
    });
  }
}
