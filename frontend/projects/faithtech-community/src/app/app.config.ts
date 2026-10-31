import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import {
  AUTH_SERVICE,
  OrganisationNames,
  SITE_SERVICE,
  provideApi,
} from '@faithtech-community/api';
import { ORGANISATION_NAMES, ThemeService } from '@faithtech-community/components';

import { sessionHintDomain } from '../environments/session-hint-domain';
import { routes } from './app.routes';
import { OrganisationTitleStrategy } from './organisation-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // The API and the identity server share the web app's origin (a reverse proxy in front of both).
    provideApi('/api', { sessionHintDomain }),
    // The host's organisation names every page before sign-in, and the shared components (L2-134).
    provideAppInitializer(() => inject(SITE_SERVICE).load()),
    { provide: ORGANISATION_NAMES, useExisting: OrganisationNames },
    { provide: TitleStrategy, useClass: OrganisationTitleStrategy },
    // Resume a stored session before the first navigation so guards see it.
    provideAppInitializer(() => inject(AUTH_SERVICE).restoreSession()),
    // Apply the theme saved on this device (Settings > Appearance) before the first page paints.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
  ],
};
