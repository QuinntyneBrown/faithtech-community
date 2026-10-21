/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/invites/accept-invite
 *   - docs/detailed-designs/invites/send-invite
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { Routes } from '@angular/router';

import { AcceptInvitePage, InvitesPage } from './pages';

export const INVITES_ROUTES: Routes = [{ path: '', component: InvitesPage }];

export const ACCEPT_INVITE_ROUTES: Routes = [{ path: ':token', component: AcceptInvitePage }];
