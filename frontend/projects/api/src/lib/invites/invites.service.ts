/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/invites/send-invite
 *   - docs/detailed-designs/invites/accept-invite
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the invites API. Pages depend on INVITES_SERVICE, never on HttpInvitesService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface InvitesService {}

export const INVITES_SERVICE = new InjectionToken<InvitesService>('INVITES_SERVICE');
