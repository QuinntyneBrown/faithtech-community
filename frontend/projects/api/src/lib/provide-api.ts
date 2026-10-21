/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 */
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, Provider, makeEnvironmentProviders } from '@angular/core';

import { API_BASE_URL, AUTH_CONFIG, AuthConfig, defaultAuthConfig } from './config';
import { authInterceptor } from './auth';
import { httpErrorInterceptor } from './errors';
import { AUTH_SERVICE, HttpAuthService } from './auth';
import { PROFILES_SERVICE, HttpProfilesService } from './profiles';
import { CONTACTS_SERVICE, HttpContactsService } from './contacts';
import { PARTNERS_SERVICE, HttpPartnersService } from './partners';
import { TEAM_SERVICE, HttpTeamService } from './team';
import { EVENTS_SERVICE, HttpEventsService } from './events';
import { SEARCH_SERVICE, HttpSearchService } from './search';
import { NOTIFICATIONS_SERVICE, HttpNotificationsService } from './notifications';
import { ANNOUNCEMENTS_SERVICE, HttpAnnouncementsService } from './announcements';
import { INVITES_SERVICE, HttpInvitesService } from './invites';
import {
  AGILE_LIVE_SERVICE,
  AGILE_SERVICE,
  HttpAgileService,
  SignalRAgileLiveService,
} from './agile';
import {
  ADMIN_USERS_SERVICE,
  HttpAdminUsersService,
  AUDIT_LOG_SERVICE,
  HttpAuditLogService,
  ROLES_SERVICE,
  HttpRolesService,
} from './admin';

/**
 * Registers HttpClient, the interceptors and every service token with its HTTP implementation.
 * Auth settings default to the current origin; override them with the second argument.
 */
export function provideApi(baseUrl: string, auth: Partial<AuthConfig> = {}): EnvironmentProviders {
  const providers: Provider[] = [
    { provide: API_BASE_URL, useValue: baseUrl },
    {
      provide: AUTH_CONFIG,
      useFactory: () => ({ ...defaultAuthConfig(window.location.origin), ...auth }),
    },
    { provide: AUTH_SERVICE, useClass: HttpAuthService },
    { provide: PROFILES_SERVICE, useClass: HttpProfilesService },
    { provide: CONTACTS_SERVICE, useClass: HttpContactsService },
    { provide: PARTNERS_SERVICE, useClass: HttpPartnersService },
    { provide: TEAM_SERVICE, useClass: HttpTeamService },
    { provide: EVENTS_SERVICE, useClass: HttpEventsService },
    { provide: SEARCH_SERVICE, useClass: HttpSearchService },
    { provide: NOTIFICATIONS_SERVICE, useClass: HttpNotificationsService },
    { provide: ANNOUNCEMENTS_SERVICE, useClass: HttpAnnouncementsService },
    { provide: INVITES_SERVICE, useClass: HttpInvitesService },
    { provide: ADMIN_USERS_SERVICE, useClass: HttpAdminUsersService },
    { provide: AUDIT_LOG_SERVICE, useClass: HttpAuditLogService },
    { provide: ROLES_SERVICE, useClass: HttpRolesService },
    { provide: AGILE_SERVICE, useClass: HttpAgileService },
    { provide: AGILE_LIVE_SERVICE, useClass: SignalRAgileLiveService },
  ];
  return makeEnvironmentProviders([
    provideHttpClient(withInterceptors([authInterceptor, httpErrorInterceptor])),
    ...providers,
  ]);
}
