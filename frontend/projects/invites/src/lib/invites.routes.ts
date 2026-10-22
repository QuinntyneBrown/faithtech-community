import { Routes } from '@angular/router';

import { AcceptInvitePage, ConnectPage, InvitesPage } from './pages';

export const INVITES_ROUTES: Routes = [{ path: '', component: InvitesPage }];

export const ACCEPT_INVITE_ROUTES: Routes = [{ path: ':token', component: AcceptInvitePage }];

/** The page a City Lead's QR code opens, at /meet/:token (ADR 0021). */
export const CONNECT_ROUTES: Routes = [{ path: ':token', component: ConnectPage }];
