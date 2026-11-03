import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  NavigationError,
  RedirectCommand,
  Router,
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withNavigationErrorHandler,
} from '@angular/router';
import {
  AUTH_SERVICE,
  OrganisationNames,
  SITE_SERVICE,
  provideApi,
} from '@faithtech-community/api';
import {
  ConnectivityService,
  ORGANISATION_NAMES,
  ThemeService,
} from '@faithtech-community/components';

import { sessionHintDomain } from '../environments/session-hint-domain';
import { routes } from './app.routes';
import { OfflineRetry } from './pages';
import { OrganisationTitleStrategy } from './organisation-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withNavigationErrorHandler(offlinePage)),
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

/**
 * A page that cannot load while the browser is offline, such as a section whose code was never fetched, shows the
 * full offline page, which remembers the page so Try again can open it (L2-048 AC4).
 */
function offlinePage(error: NavigationError): RedirectCommand | void {
  if (!inject(ConnectivityService).offline()) return;
  inject(OfflineRetry).url = error.url;
  return new RedirectCommand(inject(Router).parseUrl('/offline'), { skipLocationChange: true });
}
