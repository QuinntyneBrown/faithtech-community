import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Role } from '../shared';

/**
 * Contract for role assignment (L2-009). Pages depend on ROLES_SERVICE, never on HttpRolesService.
 * Both calls return the profile's new role set. The server answers 403 for a role the caller may not
 * change and 409 for a role already held, one not held, or the last System Admin.
 */
export interface RolesService {
  addRole(profileId: string, role: Role): Observable<Role[]>;
  removeRole(profileId: string, role: Role): Observable<Role[]>;
}

export const ROLES_SERVICE = new InjectionToken<RolesService>('ROLES_SERVICE');
