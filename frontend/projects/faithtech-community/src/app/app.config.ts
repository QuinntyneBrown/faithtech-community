/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/platform/responsive-layout-and-theming
 *   - docs/detailed-designs/identity/sign-in-and-sign-out
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideApi } from '@faithtech-community/api';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // SCAFFOLD: the API base URL comes from configuration, never a hard-coded secret.
    provideApi('/api'),
  ],
};
