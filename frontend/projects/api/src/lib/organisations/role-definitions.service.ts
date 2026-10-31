import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Capability } from '../shared/capability';

/** A role definition as the Roles page lists it (L2-136 AC6); capabilities in catalogue order. */
export interface RoleDefinitionDto {
  id: string;
  key: string;
  name: string;
  description: string;
  capabilities: Capability[];
  showOnTeam: boolean;
  chapterScopable: boolean;
  isOversight: boolean;
  holderCount: number;
  archived: boolean;
  /** The roles its holders may add and remove (L2-137); inactive until the role carries AssignRoles. */
  grantableRoleIds: string[];
}

/** POST and PUT /api/organisation/roles. The chapter-scopable flag joins it with chapter tags. */
export interface RoleDefinitionRequest {
  name: string;
  description: string;
  capabilities: string[];
  showOnTeam: boolean;
  isOversight: boolean;
}

/** An entry of the platform's capability catalogue, as GET /api/organisation/capabilities answers it. */
export interface CapabilityEntryDto {
  key: Capability;
  description: string;
}

/**
 * Contract for the organisation's role definitions (L2-136). Pages depend on ROLE_DEFINITIONS_SERVICE. Writes answer
 * 400 with field errors, 403 (with a detail when only an administrator may add administration) and 409 for the last
 * administrator, or while something still uses a role being archived; each reaches the caller rather than an error
 * page.
 */
export interface RoleDefinitionsService {
  list(archived?: boolean): Observable<RoleDefinitionDto[]>;
  capabilities(): Observable<CapabilityEntryDto[]>;
  define(request: RoleDefinitionRequest): Observable<RoleDefinitionDto>;
  update(id: string, request: RoleDefinitionRequest): Observable<RoleDefinitionDto>;
  setGrants(id: string, grantableRoleIds: string[]): Observable<RoleDefinitionDto>;
  archive(id: string): Observable<RoleDefinitionDto>;
}

export const ROLE_DEFINITIONS_SERVICE = new InjectionToken<RoleDefinitionsService>(
  'ROLE_DEFINITIONS_SERVICE',
);
