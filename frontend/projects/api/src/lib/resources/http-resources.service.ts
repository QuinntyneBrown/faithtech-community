import { HttpClient, HttpEvent, HttpEventType, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';

import { API_BASE_URL } from '../config';
import { PagedResult, toHttpParams } from '../shared';
import {
  ArchivedResource,
  ResourceDto,
  ResourceFields,
  ResourceLinkRequest,
  ResourceMember,
  ResourceQuery,
  ResourceSummary,
  ResourceTagDto,
  ResourceUploadEvent,
  ResourcesService,
} from './resources.service';

@Injectable()
export class HttpResourcesService implements ResourcesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/resources`;

  list(query: ResourceQuery): Observable<PagedResult<ResourceSummary>> {
    return this.http.get<PagedResult<ResourceSummary>>(this.base, {
      params: toHttpParams({
        q: query.q || undefined,
        type: query.type ?? undefined,
        tag: query.tag ?? undefined,
        page: query.page && query.page > 1 ? query.page : undefined,
      }),
    });
  }

  tags(q?: string): Observable<ResourceTagDto[]> {
    return this.http.get<ResourceTagDto[]>(`${this.base}/tags`, {
      params: toHttpParams({ q: q || undefined }),
    });
  }

  get(id: string): Observable<ResourceDto> {
    return this.http.get<ResourceDto>(`${this.base}/${id}`);
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/file`, { responseType: 'blob' });
  }

  thumbnail(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/thumbnail`, { responseType: 'blob' });
  }

  upload(file: File, fields: ResourceFields): Observable<ResourceUploadEvent> {
    const form = new FormData();
    form.append('files', file, file.name);
    if (fields.title) form.append('title', fields.title);
    if (fields.description) form.append('description', fields.description);
    if (fields.type) form.append('type', fields.type);
    form.append('visibility', fields.visibility);
    fields.tags.forEach((tag) => form.append('tags', tag));
    fields.memberIds.forEach((id) => form.append('memberIds', id));
    fields.roles.forEach((role) => form.append('roles', role));
    return this.send<ResourceDto[]>('POST', this.base, form, (added) => added[0]);
  }

  addLink(link: ResourceLinkRequest): Observable<ResourceDto> {
    return this.http.post<ResourceDto>(`${this.base}/links`, link);
  }

  update(id: string, fields: ResourceFields & { url?: string | null }): Observable<ResourceDto> {
    return this.http.put<ResourceDto>(`${this.base}/${id}`, fields);
  }

  replaceFile(id: string, file: File): Observable<ResourceUploadEvent> {
    const form = new FormData();
    form.append('files', file, file.name);
    return this.send<ResourceDto>('PUT', `${this.base}/${id}/file`, form, (resource) => resource);
  }

  archive(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/archive`, null);
  }

  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/restore`, null);
  }

  archived(): Observable<ArchivedResource[]> {
    return this.http.get<ArchivedResource[]>(`${this.base}/archived`);
  }

  members(q: string): Observable<ResourceMember[]> {
    return this.http.get<ResourceMember[]>(`${this.base}/members`, { params: toHttpParams({ q }) });
  }

  ownerCandidates(q: string): Observable<ResourceMember[]> {
    return this.http.get<ResourceMember[]>(`${this.base}/owner-candidates`, {
      params: toHttpParams({ q }),
    });
  }

  transferOwner(id: string, ownerId: string | null): Observable<ResourceDto> {
    return this.http.put<ResourceDto>(`${this.base}/${id}/owner`, { ownerId });
  }

  /** Sends a multipart body, reporting upload progress and then the saved resource. */
  private send<T>(
    method: string,
    url: string,
    form: FormData,
    pick: (body: T) => ResourceDto,
  ): Observable<ResourceUploadEvent> {
    const request = new HttpRequest(method, url, form, { reportProgress: true });
    return this.http.request<T>(request).pipe(
      filter(
        (event: HttpEvent<T>) =>
          event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response,
      ),
      map((event): ResourceUploadEvent => {
        if (event.type === HttpEventType.UploadProgress) {
          const percent = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
          return { kind: 'progress', percent };
        }
        return { kind: 'done', resource: pick((event as { body: T }).body) };
      }),
    );
  }
}
