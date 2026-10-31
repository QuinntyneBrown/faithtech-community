import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { OrganisationNames, Site, provideApi, provideLoadedSite } from '@faithtech-community/api';
import { ORGANISATION_NAMES } from '@faithtech-community/components';

import { communityOrigin as builtCommunityOrigin } from '../environments/community-origin';
import { routes } from './app.routes';
import { COMMUNITY_ORIGIN } from './community-origin';

/**
 * The marketing app on the public host whose site was read before start (main.ts). The API and the identity server
 * sit on that organisation's community origin, which the site names; the build-time origin (ADR 0018) is only the
 * fallback when the site could not be read.
 */
export function marketingConfig(site: Site | null): ApplicationConfig {
  const communityOrigin = site?.communityOrigin ?? builtCommunityOrigin;
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(routes, withComponentInputBinding()),
      provideApi(`${communityOrigin}/api`, { authority: communityOrigin }),
      { provide: COMMUNITY_ORIGIN, useValue: communityOrigin },
      // The headline, name, brochure and footer come from the host's site (L2-134 AC1, AC3).
      provideLoadedSite(site),
      { provide: ORGANISATION_NAMES, useExisting: OrganisationNames },
    ],
  };
}
