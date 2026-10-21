/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/profiles/view-profile
 *   - docs/detailed-designs/profiles/edit-own-profile
 *   - docs/detailed-designs/profiles/manage-profile-photos
 */
export * from './profiles.service';
export * from './http-profiles.service';
