import { Routes } from '@angular/router';

import { ChaptersPage, GeneralPage, OrganisationPage, RolesPage } from './pages';

/** The Organisation section; the app guards it by capability. The taxonomies join as a tab later. */
export const ORGANISATION_ROUTES: Routes = [
  {
    path: '',
    component: OrganisationPage,
    children: [
      { path: '', component: GeneralPage },
      { path: 'roles', component: RolesPage },
      { path: 'chapters', component: ChaptersPage },
    ],
  },
];
