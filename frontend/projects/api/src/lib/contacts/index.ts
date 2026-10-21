/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/contacts/manage-contacts
 *   - docs/detailed-designs/contacts/contact-notes
 *   - docs/detailed-designs/contacts/archive-restore-delete-contacts
 *   - docs/detailed-designs/contacts/link-contact-on-sign-up
 */
export * from './contacts.service';
export * from './http-contacts.service';
