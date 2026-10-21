/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/admin/assign-roles
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the roles API. Pages depend on ROLES_SERVICE, never on HttpRolesService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface RolesService {}

export const ROLES_SERVICE = new InjectionToken<RolesService>('ROLES_SERVICE');
