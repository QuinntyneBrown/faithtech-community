import { Routes } from '@angular/router';

import { ChaptersPage, GeneralPage, OrganisationPage, RolesPage, TaxonomiesPage } from './pages';

/**
 * The Organisation section's routes, with `extra` tabs another library provides, mounted by the app shell so neither
 * library imports the other (ADR 0043: the events library's Hub templates). The app guards the section by capability.
 */
export function organisationRoutes(extra: Routes = []): Routes {
  return [
    {
      path: '',
      component: OrganisationPage,
      children: [
        { path: '', component: GeneralPage },
        { path: 'roles', component: RolesPage },
        { path: 'chapters', component: ChaptersPage },
        { path: 'taxonomies', component: TaxonomiesPage },
        ...extra,
      ],
    },
  ];
}

/** The Organisation section without extra tabs. */
export const ORGANISATION_ROUTES: Routes = organisationRoutes();
