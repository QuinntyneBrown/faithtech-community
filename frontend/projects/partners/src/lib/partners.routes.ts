/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/partners/manage-partners
 *   - docs/detailed-designs/partners/partner-kanban-board
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { Routes } from '@angular/router';

import { PartnerPage, PartnersPage } from './pages';

export const PARTNERS_ROUTES: Routes = [
  { path: '', component: PartnersPage },
  { path: ':id', component: PartnerPage },
];
