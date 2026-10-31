import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { OrganisationNames, SITE_SERVICE, provideApi } from '@faithtech-community/api';
import { ORGANISATION_NAMES } from '@faithtech-community/components';

import { communityOrigin } from '../environments/community-origin';
import { routes } from './app.routes';
import { COMMUNITY_ORIGIN } from './community-origin';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // The API and the identity server sit on the community app's origin, not this one.
    provideApi(`${communityOrigin}/api`, { authority: communityOrigin }),
    { provide: COMMUNITY_ORIGIN, useValue: communityOrigin },
    // The shared components name the community's organisation (L2-134 AC1); per-host sites come in slice 05.
    provideAppInitializer(() => inject(SITE_SERVICE).load()),
    { provide: ORGANISATION_NAMES, useExisting: OrganisationNames },
  ],
};
