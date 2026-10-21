import { Routes } from '@angular/router';

import { AdminUsersPage, AuditLogPage } from './pages';

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  { path: 'users', component: AdminUsersPage },
  { path: 'audit-log', component: AuditLogPage },
];
