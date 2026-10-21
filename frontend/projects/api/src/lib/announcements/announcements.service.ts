/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/announcements/send-announcement
 *   - docs/detailed-designs/announcements/read-announcements-and-opt-out
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the announcements API. Pages depend on ANNOUNCEMENTS_SERVICE, never on HttpAnnouncementsService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface AnnouncementsService {}

export const ANNOUNCEMENTS_SERVICE = new InjectionToken<AnnouncementsService>(
  'ANNOUNCEMENTS_SERVICE',
);
