import { Routes } from '@angular/router';

import { WorkspaceSettingsPage, WorkspacesPage } from './pages';

export const AGILE_ROUTES: Routes = [
  { path: '', component: WorkspacesPage },
  { path: ':id', pathMatch: 'full', redirectTo: ':id/settings' },
  { path: ':id/settings', component: WorkspaceSettingsPage },
];
