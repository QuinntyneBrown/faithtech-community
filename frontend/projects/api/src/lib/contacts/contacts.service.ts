/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/contacts/manage-contacts
 *   - docs/detailed-designs/contacts/contact-notes
 *   - docs/detailed-designs/contacts/archive-restore-delete-contacts
 *   - docs/detailed-designs/contacts/link-contact-on-sign-up
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { InjectionToken } from '@angular/core';

/** Contract for the contacts API. Pages depend on CONTACTS_SERVICE, never on HttpContactsService. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SCAFFOLD: members come from the detailed design
export interface ContactsService {}

export const CONTACTS_SERVICE = new InjectionToken<ContactsService>('CONTACTS_SERVICE');
