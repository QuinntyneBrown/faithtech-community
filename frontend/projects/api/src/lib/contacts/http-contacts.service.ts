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
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { toHttpParams } from '../shared';
import {
  ContactDto,
  ContactNoteDto,
  ContactSummary,
  ContactsService,
  CreateContactRequest,
  UpdateContactRequest,
} from './contacts.service';

@Injectable()
export class HttpContactsService implements ContactsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/contacts`;

  list(term?: string): Observable<ContactSummary[]> {
    return this.http.get<ContactSummary[]>(this.base, { params: toHttpParams({ q: term }) });
  }

  get(id: string): Observable<ContactDto> {
    return this.http.get<ContactDto>(`${this.base}/${id}`);
  }

  create(contact: CreateContactRequest): Observable<ContactDto> {
    return this.http.post<ContactDto>(this.base, contact);
  }

  update(id: string, contact: UpdateContactRequest): Observable<ContactDto> {
    return this.http.put<ContactDto>(`${this.base}/${id}`, contact);
  }

  listArchived(): Observable<ContactSummary[]> {
    return this.http.get<ContactSummary[]>(`${this.base}/archived`);
  }

  archive(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/archive`, null);
  }

  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/restore`, null);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getNotes(contactId: string): Observable<ContactNoteDto[]> {
    return this.http.get<ContactNoteDto[]>(`${this.base}/${contactId}/notes`);
  }

  addNote(contactId: string, body: string): Observable<ContactNoteDto> {
    return this.http.post<ContactNoteDto>(`${this.base}/${contactId}/notes`, { body });
  }

  link(contactId: string, profileId: string): Observable<ContactDto> {
    return this.http.post<ContactDto>(`${this.base}/${contactId}/link`, { profileId });
  }
}
