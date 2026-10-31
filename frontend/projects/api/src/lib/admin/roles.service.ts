import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { ProfileRole } from '../shared';

/**
 * Contract for role assignment by definition id (L2-138). Pages depend on ROLES_SERVICE, never on
 * HttpRolesService. Both calls return the profile's held roles. The server answers 400 for an archived or
 * unknown role, 403 for one the caller's rules do not let them grant, and 409 for a role already held, one
 * not held, or the last administrator.
 */
export interface RolesService {
  addRole(profileId: string, roleId: string): Observable<ProfileRole[]>;
  removeRole(profileId: string, roleId: string): Observable<ProfileRole[]>;
}

export const ROLES_SERVICE = new InjectionToken<RolesService>('ROLES_SERVICE');
