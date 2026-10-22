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
  /**
   * The card's photo (L2-072): the linked member's featured photo, or else the contact's own, whose URL is an
   * API path that must be loaded through `photoImage` (ADR 0017). Null when there is none, or it is storing.
   */
  photoUrl: string | null;
  photoAltText: string | null;
  noteCount: number;
  createdAtUtc: string;
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
  /** The linked member's featured photo, or else the contact's own (an API path, see `photoImage`). */
  photoUrl: string | null;
  photoAltText: string | null;
  match: ContactMatch | null;
  archivedAtUtc: string | null;
  noteCount: number;
  /** False when a System Admin opens another lead's contact (audited). */
  isOwn: boolean;
  createdAtUtc: string;
  /** The contact's own photos, newest first (L2-068). */
  photos: ContactPhoto[];
}

/** A contact photo. `url` is an API path to load through `photoImage`; null while it is storing. */
export interface ContactPhoto {
  id: string;
  url: string | null;
  altText: string;
  isFeatured: boolean;
  uploadedAt: string;
  /** False while the image waits for storage (L2-071). */
  isStored: boolean;
}

/** The caller's own contact with the same email, active or archived (L2-091). */
export interface DuplicateContactDto {
  id: string;
  name: string;
  organization: string | null;
  email: string;
  addedAtUtc: string;
  noteCount: number;
  isArchived: boolean;
}

export interface ContactNoteDto {
  id: string;
  body: string;
  createdAtUtc: string;
}

/**
 * Contract for the contacts API (L2-012 to L2-016, ADR 0014). Pages depend on CONTACTS_SERVICE,
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
  /**
   * The caller's own contact with this email, trimmed and case-insensitive, excluding the contact being
   * edited; null when there is none (204). Never another lead's contact (L2-091).
   */
  findDuplicate(email: string, excludeId?: string): Observable<DuplicateContactDto | null>;
  /** JPEG, PNG or WebP up to 5 MB with a description; at most 10. 400 errors are keyed File or AltText. */
  uploadPhoto(contactId: string, file: File, altText: string): Observable<ContactPhoto>;
  describePhoto(contactId: string, photoId: string, altText: string): Observable<void>;
  setFeaturedPhoto(contactId: string, photoId: string): Observable<void>;
  /** The newest remaining photo becomes featured when the featured one is deleted. */
  deletePhoto(contactId: string, photoId: string): Observable<void>;
  /**
   * An image URL the browser can show. A contact photo's URL is an API path that needs the bearer token, so
   * its image is fetched and returned as an object URL, once per session; any other URL is returned as it is.
   */
  photoImage(url: string): Observable<string>;
}

export const CONTACTS_SERVICE = new InjectionToken<ContactsService>('CONTACTS_SERVICE');
