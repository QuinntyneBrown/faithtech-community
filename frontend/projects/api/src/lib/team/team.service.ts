/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/team/team-list
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the team API. Pages depend on TEAM_SERVICE, never on HttpTeamService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface TeamService {}

export const TEAM_SERVICE = new InjectionToken<TeamService>('TEAM_SERVICE');
