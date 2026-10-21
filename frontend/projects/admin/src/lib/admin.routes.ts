/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/admin/admin-users-and-override
 *   - docs/detailed-designs/admin/assign-roles
 *   - docs/detailed-designs/admin/audit-log
 *   - docs/detailed-designs/admin/suspend-users
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { Routes } from '@angular/router';

import { AdminUsersPage, AuditLogPage } from './pages';

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  { path: 'users', component: AdminUsersPage },
  { path: 'audit-log', component: AuditLogPage },
];
