import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { PagedResult, toHttpParams } from '../shared';
import {
  ArchivedNote,
  NoteImageUploaded,
  NoteMember,
  NotePageDto,
  NotePageRef,
  NotePageSummary,
  NoteQuery,
  NoteSave,
  NoteSaved,
  NoteVisibilityChange,
  NotesService,
} from './notes.service';

@Injectable()
export class HttpNotesService implements NotesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/notes`;

  list(query: NoteQuery): Observable<PagedResult<NotePageSummary>> {
    return this.http.get<PagedResult<NotePageSummary>>(this.base, {
      params: toHttpParams({
        q: query.q || undefined,
        owner: query.owner && query.owner !== 'all' ? query.owner : undefined,
        page: query.page && query.page > 1 ? query.page : undefined,
      }),
    });
  }

  create(title?: string | null, parentId?: string | null): Observable<NotePageDto> {
    return this.http.post<NotePageDto>(this.base, {
      title: title ?? null,
      parentId: parentId ?? null,
    });
  }

  get(id: string): Observable<NotePageDto> {
    return this.http.get<NotePageDto>(`${this.base}/${id}`);
  }

  save(id: string, page: NoteSave): Observable<NoteSaved> {
    return this.http.put<NoteSaved>(`${this.base}/${id}`, page);
  }

  setVisibility(id: string, change: NoteVisibilityChange): Observable<NotePageDto> {
    return this.http.put<NotePageDto>(`${this.base}/${id}/visibility`, change);
  }

  move(id: string, parentId: string | null): Observable<NotePageDto> {
    return this.http.put<NotePageDto>(`${this.base}/${id}/parent`, { parentId });
  }

  archive(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/archive`, null);
  }

  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/restore`, null);
  }

  archived(): Observable<ArchivedNote[]> {
    return this.http.get<ArchivedNote[]>(`${this.base}/archived`);
  }

  linkSuggestions(q: string, exclude?: string): Observable<NotePageRef[]> {
    return this.http.get<NotePageRef[]>(`${this.base}/links`, {
      params: toHttpParams({ q: q || undefined, exclude }),
    });
  }

  parentOptions(id: string, q?: string): Observable<NotePageRef[]> {
    return this.http.get<NotePageRef[]>(`${this.base}/${id}/parent-options`, {
      params: toHttpParams({ q: q || undefined }),
    });
  }

  members(q: string): Observable<NoteMember[]> {
    return this.http.get<NoteMember[]>(`${this.base}/members`, { params: toHttpParams({ q }) });
  }

  uploadImage(id: string, file: File): Observable<NoteImageUploaded> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<NoteImageUploaded>(`${this.base}/${id}/images`, form);
  }

  image(id: string, imageId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/images/${imageId}`, { responseType: 'blob' });
  }
}
