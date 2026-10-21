/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/admin/admin-users-and-override
 *   - docs/detailed-designs/admin/suspend-users
 */
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PagedResult, Role } from '../shared';

export type UserStatus = 'Active' | 'Suspended' | 'Unverified';

export interface AdminUserSummary {
  profileId: string;
  name: string;
  email: string;
  roles: Role[];
  status: UserStatus;
}

/**
 * Contract for System Admin user management. Pages depend on ADMIN_USERS_SERVICE, never on HttpAdminUsersService.
 * TODO(slice): page size and the reason's maximum length are open in the designs.
 */
export interface AdminUsersService {
  search(term: string, page?: number): Observable<PagedResult<AdminUserSummary>>;
  suspend(userId: string, reason: string): Observable<void>;
  reinstate(userId: string): Observable<void>;
}

export const ADMIN_USERS_SERVICE = new InjectionToken<AdminUsersService>('ADMIN_USERS_SERVICE');
