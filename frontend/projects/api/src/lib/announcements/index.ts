/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/announcements/send-announcement
 *   - docs/detailed-designs/announcements/read-announcements-and-opt-out
 */
export * from './announcements.service';
export * from './http-announcements.service';
