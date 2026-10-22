import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideApi } from '@faithtech-community/api';

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
  ],
};
