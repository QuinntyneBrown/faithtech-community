import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PagedResult, Role } from '../shared';

export type UserStatus = 'Active' | 'Suspended' | 'Unverified';

export interface AdminUserSummary {
  /** The profile id; admin routes address users by it. */
  id: string;
  name: string;
  email: string;
  roles: Role[];
  status: UserStatus;
}

/**
 * Contract for System Admin user management (L2-039, L2-040). Pages depend on ADMIN_USERS_SERVICE,
 * never on HttpAdminUsersService. Every call answers 403 to anyone but a System Admin.
 */
export interface AdminUsersService {
  /** 25 per page by name; the term matches name or email. */
  search(term: string, page?: number): Observable<PagedResult<AdminUserSummary>>;
  /** Reason up to 500 characters. 409 for the caller's own account or one already suspended. */
  suspend(id: string, reason: string): Observable<void>;
  reinstate(id: string): Observable<void>;
}

export const ADMIN_USERS_SERVICE = new InjectionToken<AdminUsersService>('ADMIN_USERS_SERVICE');
