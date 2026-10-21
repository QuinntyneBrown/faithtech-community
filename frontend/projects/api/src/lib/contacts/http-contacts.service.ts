import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN } from '../errors';
import { toHttpParams } from '../shared';
import {
  ContactDto,
  ContactNoteDto,
  ContactRequest,
  ContactSummary,
  ContactsService,
  CreateContactRequest,
} from './contacts.service';

@Injectable()
export class HttpContactsService implements ContactsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/contacts`;
  // The contacts page shows its own "private to each lead" state for callers without a lead role.
  private readonly context = new HttpContext().set(HANDLES_FORBIDDEN, true);

  list(term?: string): Observable<ContactSummary[]> {
    return this.http.get<ContactSummary[]>(this.base, {
      params: toHttpParams({ q: term }),
      context: this.context,
    });
  }

  get(id: string): Observable<ContactDto> {
    return this.http.get<ContactDto>(`${this.base}/${id}`);
  }

  create(contact: CreateContactRequest): Observable<ContactDto> {
    return this.http.post<ContactDto>(this.base, contact);
  }

  update(id: string, contact: ContactRequest): Observable<ContactDto> {
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

  link(contactId: string, profileId: string, discardNotes: boolean): Observable<ContactDto> {
    return this.http.post<ContactDto>(`${this.base}/${contactId}/link`, {
      profileId,
      discardNotes,
    });
  }
}
