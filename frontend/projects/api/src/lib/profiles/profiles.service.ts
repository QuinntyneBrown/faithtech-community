/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/profiles/view-profile
 *   - docs/detailed-designs/profiles/edit-own-profile
 *   - docs/detailed-designs/profiles/manage-profile-photos
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the profiles API. Pages depend on PROFILES_SERVICE, never on HttpProfilesService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface ProfilesService {}

export const PROFILES_SERVICE = new InjectionToken<ProfilesService>('PROFILES_SERVICE');
