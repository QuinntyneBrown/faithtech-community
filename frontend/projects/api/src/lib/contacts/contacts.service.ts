import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** Private (unlinked), SignedUp (a verified member uses the email) or Member (linked). */
export type ContactStatus = 'Private' | 'SignedUp' | 'Member';

export interface ContactRequest {
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  city: string | null;
}

export interface CreateContactRequest extends ContactRequest {
  /** The optional first note. */
  notes?: string | null;
  /** "Save and link": create the contact already linked to the member who uses its email. */
  linkToMember?: boolean;
}

export interface ContactSummary {
  id: string;
  name: string;
  email: string | null;
  organization: string | null;
  city: string | null;
  status: ContactStatus;
  /** Set on archived contacts only. */
  archivedAtUtc: string | null;
}

/** A verified member who uses the contact's email, offered for linking (L2-015). */
export interface ContactMatch {
  profileId: string;
  name: string;
}

export interface ContactDto {
  id: string;
  /** Once linked, the member's own name. */
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  city: string | null;
  linkedProfileId: string | null;
  /** The linked member's featured photo. */
  photoUrl: string | null;
  photoAltText: string | null;
  match: ContactMatch | null;
  archivedAtUtc: string | null;
  noteCount: number;
  /** False when a System Admin opens another lead's contact (audited). */
  isOwn: boolean;
  createdAtUtc: string;
}

export interface ContactNoteDto {
  id: string;
  body: string;
  createdAtUtc: string;
}

/**
 * Contract for the contacts API (L2-012 to L2-016, ADR 0009). Pages depend on CONTACTS_SERVICE,
 * never on HttpContactsService. Contacts are private to the creating lead and System Admin; the
 * server answers 404 for anyone else's contact and 403 for the list to anyone without a lead role.
 */
export interface ContactsService {
  /** The caller's active contacts by name, filtered on name, email, organisation or notes. */
  list(term?: string): Observable<ContactSummary[]>;
  get(id: string): Observable<ContactDto>;
  /** 400 per field; 409 with `memberName` when the email belongs to a member and linkToMember is not set. */
  create(contact: CreateContactRequest): Observable<ContactDto>;
  update(id: string, contact: ContactRequest): Observable<ContactDto>;
  listArchived(): Observable<ContactSummary[]>;
  archive(id: string): Observable<void>;
  restore(id: string): Observable<void>;
  /** Only an archived contact can be deleted (409 otherwise). */
  delete(id: string): Observable<void>;
  /** Newest first. */
  getNotes(contactId: string): Observable<ContactNoteDto[]>;
  addNote(contactId: string, body: string): Observable<ContactNoteDto>;
  link(contactId: string, profileId: string, discardNotes: boolean): Observable<ContactDto>;
}

export const CONTACTS_SERVICE = new InjectionToken<ContactsService>('CONTACTS_SERVICE');
