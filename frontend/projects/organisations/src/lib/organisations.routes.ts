import { Routes } from '@angular/router';

import { GeneralPage, OrganisationPage, RolesPage } from './pages';

/** The Organisation section; the app guards it by capability. Chapters and taxonomies join as tabs later. */
export const ORGANISATION_ROUTES: Routes = [
  {
    path: '',
    component: OrganisationPage,
    children: [
      { path: '', component: GeneralPage },
      { path: 'roles', component: RolesPage },
    ],
  },
];
