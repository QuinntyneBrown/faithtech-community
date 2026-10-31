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
  /** Adds the role, tagged with `chapterId` when given (L2-143). */
  addRole(profileId: string, roleId: string, chapterId?: string | null): Observable<ProfileRole[]>;
  /** Removes the assignment with exactly this tag; none removes the untagged one (L2-143 AC2). */
  removeRole(
    profileId: string,
    roleId: string,
    chapterId?: string | null,
  ): Observable<ProfileRole[]>;
}

export const ROLES_SERVICE = new InjectionToken<RolesService>('ROLES_SERVICE');
