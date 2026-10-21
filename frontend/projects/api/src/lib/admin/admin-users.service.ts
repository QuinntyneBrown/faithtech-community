/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/admin/admin-users-and-override
 *   - docs/detailed-designs/admin/suspend-users
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the admin users API. Pages depend on ADMIN_USERS_SERVICE, never on HttpAdminUsersService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface AdminUsersService {}

export const ADMIN_USERS_SERVICE = new InjectionToken<AdminUsersService>('ADMIN_USERS_SERVICE');
