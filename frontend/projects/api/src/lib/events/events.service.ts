/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/events/event-list-and-filter
 *   - docs/detailed-designs/events/create-and-edit-events
 *   - docs/detailed-designs/events/rsvp
 *   - docs/detailed-designs/events/cancel-events
 *   - docs/detailed-designs/events/public-events-and-guest-rsvp
 *   - docs/detailed-designs/events/calendar-export
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the events API. Pages depend on EVENTS_SERVICE, never on HttpEventsService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface EventsService {}

export const EVENTS_SERVICE = new InjectionToken<EventsService>('EVENTS_SERVICE');
