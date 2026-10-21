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
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export interface CreateContactRequest {
  name: string;
  email: string;
  phone: string;
  organization: string;
  notes: string;
}

export type UpdateContactRequest = CreateContactRequest;

export interface ContactSummary {
  id: string;
  name: string;
  email: string;
  organization: string;
  linkedProfileId: string | null;
}

export interface ContactDto extends ContactSummary {
  phone: string;
  /** Present once linked: name and photo then come from the profile. */
  linkedPhotoUrl: string | null;
  archivedAt: string | null;
}

export interface ContactNoteDto {
  id: string;
  contactId: string;
  body: string;
  createdAt: string;
}

/**
 * Contract for the contacts API. Pages depend on CONTACTS_SERVICE, never on HttpContactsService.
 * Contacts are private to the creating lead and System Admin; the server enforces that with 404s.
 * TODO(slice): ContactDto/ContactSummary fields are inferred; L2 adds city and note search; lists are not paged.
 */
export interface ContactsService {
  list(term?: string): Observable<ContactSummary[]>;
  get(id: string): Observable<ContactDto>;
  create(contact: CreateContactRequest): Observable<ContactDto>;
  update(id: string, contact: UpdateContactRequest): Observable<ContactDto>;
  listArchived(): Observable<ContactSummary[]>;
  archive(id: string): Observable<void>;
  restore(id: string): Observable<void>;
  /** Only archived contacts can be deleted (409 otherwise). */
  delete(id: string): Observable<void>;
  getNotes(contactId: string): Observable<ContactNoteDto[]>;
  addNote(contactId: string, body: string): Observable<ContactNoteDto>;
  link(contactId: string, profileId: string): Observable<ContactDto>;
}

export const CONTACTS_SERVICE = new InjectionToken<ContactsService>('CONTACTS_SERVICE');
