/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/partners/manage-partners
 *   - docs/detailed-designs/partners/partner-kanban-board
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the partners API. Pages depend on PARTNERS_SERVICE, never on HttpPartnersService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface PartnersService {}

export const PARTNERS_SERVICE = new InjectionToken<PartnersService>('PARTNERS_SERVICE');
