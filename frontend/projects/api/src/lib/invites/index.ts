/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/invites/send-invite
 *   - docs/detailed-designs/invites/accept-invite
 */
export * from './invites.service';
export * from './http-invites.service';
