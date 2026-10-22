import { Routes } from '@angular/router';

import { ArchivedResourcesPage, ResourcePage, ResourcesPage } from './pages';

export const RESOURCES_ROUTES: Routes = [
  { path: '', component: ResourcesPage },
  { path: 'archived', component: ArchivedResourcesPage },
  { path: ':id', component: ResourcePage },
];
