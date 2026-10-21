/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/notifications/in-app-notifications
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the notifications API. Pages depend on NOTIFICATIONS_SERVICE, never on HttpNotificationsService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface NotificationsService {}

export const NOTIFICATIONS_SERVICE = new InjectionToken<NotificationsService>(
  'NOTIFICATIONS_SERVICE',
);
