import { Routes } from '@angular/router';

import { AcceptInvitePage, InvitesPage } from './pages';

export const INVITES_ROUTES: Routes = [{ path: '', component: InvitesPage }];

export const ACCEPT_INVITE_ROUTES: Routes = [{ path: ':token', component: AcceptInvitePage }];
