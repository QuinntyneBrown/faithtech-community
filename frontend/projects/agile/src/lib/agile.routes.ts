import { Routes } from '@angular/router';

import { BacklogPage, WorkItemPage, WorkspaceSettingsPage, WorkspacesPage } from './pages';

export const AGILE_ROUTES: Routes = [
  { path: '', component: WorkspacesPage },
  { path: ':id', pathMatch: 'full', redirectTo: ':id/backlog' },
  { path: ':id/backlog', component: BacklogPage },
  { path: ':id/items/:itemId', component: WorkItemPage },
  { path: ':id/settings', component: WorkspaceSettingsPage },
];
