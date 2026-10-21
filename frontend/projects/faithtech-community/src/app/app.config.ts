import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { AUTH_SERVICE, provideApi } from '@faithtech-community/api';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // The API and the identity server share the web app's origin (a reverse proxy in front of both).
    provideApi('/api'),
    // Resume a stored session before the first navigation so guards see it.
    provideAppInitializer(() => inject(AUTH_SERVICE).restoreSession()),
  ],
};
