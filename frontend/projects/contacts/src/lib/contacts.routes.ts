/*
 * SCAFFOLD: placeholder, not the implementation.
 * Generated from AGENTS.md and:
 *   - docs/detailed-designs/contacts/archive-restore-delete-contacts
 *   - docs/detailed-designs/contacts/contact-notes
 *   - docs/detailed-designs/contacts/link-contact-on-sign-up
 *   - docs/detailed-designs/contacts/manage-contacts
 * Overwrite this file with the expected implementation (implementing-incrementally
 * skill + ATDD), then delete this comment.
 */
import { Routes } from '@angular/router';

import { ArchivedContactsPage, ContactFormPage, ContactPage, ContactsPage } from './pages';

export const CONTACTS_ROUTES: Routes = [
  { path: '', component: ContactsPage },
  { path: 'new', component: ContactFormPage },
  { path: 'archived', component: ArchivedContactsPage },
  { path: ':id', component: ContactPage },
  { path: ':id/edit', component: ContactFormPage },
];
