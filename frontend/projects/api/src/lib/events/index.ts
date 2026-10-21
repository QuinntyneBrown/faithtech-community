/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/events/event-list-and-filter
 *   - docs/detailed-designs/events/create-and-edit-events
 *   - docs/detailed-designs/events/rsvp
 *   - docs/detailed-designs/events/cancel-events
 *   - docs/detailed-designs/events/public-events-and-guest-rsvp
 *   - docs/detailed-designs/events/calendar-export
 */
export * from './events.service';
export * from './http-events.service';
