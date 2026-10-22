import { Routes } from '@angular/router';

import { authGuard } from './guards';
import {
  AuthCallbackPage,
  AuthContinuePage,
  ForbiddenPage,
  ForgotPasswordPage,
  HomePage,
  NotFoundPage,
  ResetPasswordPage,
  ServerErrorPage,
  SignInPage,
  SignUpPage,
  VerifyEmailPage,
} from './pages';
import { AppShellComponent, PublicShellComponent } from './shell';

export const routes: Routes = [
  { path: 'sign-in', component: SignInPage },
  { path: 'auth/callback', component: AuthCallbackPage },
  // The marketing page and Google sign-in hand their session over here (ADR 0018).
  { path: 'auth/continue', component: AuthContinuePage },
  { path: 'sign-up', component: SignUpPage },
  { path: 'verify-email', component: VerifyEmailPage },
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'reset-password', component: ResetPasswordPage },
  {
    path: 'public/events',
    component: PublicShellComponent,
    loadChildren: () => import('@faithtech-community/events').then((m) => m.PUBLIC_EVENT_ROUTES),
  },
  {
    path: 'accept-invite',
    loadChildren: () => import('@faithtech-community/invites').then((m) => m.ACCEPT_INVITE_ROUTES),
  },
  // The unsubscribe link in announcement emails works without a sign-in (L2-030 AC3).
  {
    path: 'unsubscribe',
    loadChildren: () =>
      import('@faithtech-community/announcements').then((m) => m.UNSUBSCRIBE_ROUTES),
  },
  { path: 'forbidden', component: ForbiddenPage },
  { path: 'error', component: ServerErrorPage },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', component: HomePage },
      {
        path: 'people',
        loadChildren: () => import('@faithtech-community/profiles').then((m) => m.PROFILES_ROUTES),
      },
      {
        path: 'contacts',
        loadChildren: () => import('@faithtech-community/contacts').then((m) => m.CONTACTS_ROUTES),
      },
      {
        path: 'partners',
        loadChildren: () => import('@faithtech-community/partners').then((m) => m.PARTNERS_ROUTES),
      },
      {
        path: 'workspaces',
        loadChildren: () => import('@faithtech-community/agile').then((m) => m.AGILE_ROUTES),
      },
      {
        path: 'team',
        loadChildren: () => import('@faithtech-community/team').then((m) => m.TEAM_ROUTES),
      },
      {
        path: 'events',
        loadChildren: () => import('@faithtech-community/events').then((m) => m.EVENTS_ROUTES),
      },
      {
        path: 'search',
        loadChildren: () => import('@faithtech-community/search').then((m) => m.SEARCH_ROUTES),
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('@faithtech-community/notifications').then((m) => m.NOTIFICATIONS_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('@faithtech-community/notifications').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'announcements',
        loadChildren: () =>
          import('@faithtech-community/announcements').then((m) => m.ANNOUNCEMENTS_ROUTES),
      },
      {
        path: 'invites',
        loadChildren: () => import('@faithtech-community/invites').then((m) => m.INVITES_ROUTES),
      },
      {
        path: 'admin',
        loadChildren: () => import('@faithtech-community/admin').then((m) => m.ADMIN_ROUTES),
      },
    ],
  },
  { path: '**', component: NotFoundPage },
];
