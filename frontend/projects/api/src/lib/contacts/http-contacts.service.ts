import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, throwError } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import { toHttpParams } from '../shared';
import {
  ContactDto,
  ContactNoteDto,
  ContactPhoto,
  ContactRequest,
  ContactSummary,
  ContactsService,
  CreateContactRequest,
  DuplicateContactDto,
} from './contacts.service';

@Injectable()
export class HttpContactsService implements ContactsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly base = `${this.api}/contacts`;
  private readonly images = new Map<string, Observable<string>>();
  // The contacts page shows its own "private to each lead" state for callers without a lead role.
  private readonly context = new HttpContext().set(HANDLES_FORBIDDEN, true);
  // The duplicate check is advice: the form ignores its failure and saves anyway (L2-091 AC7).
  private readonly advisory = new HttpContext()
    .set(HANDLES_FORBIDDEN, true)
    .set(HANDLES_SERVER_ERROR, true);

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
    return this.http.get<ContactSummary[]>(`${this.base}/archived`, { context: this.context });
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

  findDuplicate(email: string, excludeId?: string): Observable<DuplicateContactDto | null> {
    return this.http
      .get<DuplicateContactDto | null>(`${this.base}/duplicates`, {
        params: toHttpParams({ email, excludeId }),
        observe: 'response',
        context: this.advisory,
      })
      .pipe(map((response) => (response.status === 204 ? null : response.body)));
  }

  uploadPhoto(contactId: string, file: File, altText: string): Observable<ContactPhoto> {
    const form = new FormData();
    form.append('file', file);
    form.append('altText', altText);
    return this.http.post<ContactPhoto>(`${this.base}/${contactId}/photos`, form);
  }

  describePhoto(contactId: string, photoId: string, altText: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${contactId}/photos/${photoId}`, { altText });
  }

  setFeaturedPhoto(contactId: string, photoId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${contactId}/photos/${photoId}/featured`, null);
  }

  deletePhoto(contactId: string, photoId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${contactId}/photos/${photoId}`);
  }

  photoImage(url: string): Observable<string> {
    if (!url.startsWith('/api/contacts/')) return of(url);
    let image = this.images.get(url);
    if (!image) {
      image = this.http
        .get(`${this.api}${url.slice('/api'.length)}`, { responseType: 'blob' })
        .pipe(
          map((blob) => URL.createObjectURL(blob)),
          // A failed fetch is not remembered, so the next request tries again.
          catchError((error: unknown) => {
            this.images.delete(url);
            return throwError(() => error);
          }),
          shareReplay(1),
        );
      this.images.set(url, image);
    }
    return image;
  }
}
