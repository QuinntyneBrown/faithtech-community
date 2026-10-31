import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN, HANDLES_SERVER_ERROR } from '../errors';
import {
  ChapterDto,
  OrganisationDto,
  OrganisationService,
  PartnerStageChange,
  PartnerStageDto,
  UpdateOrganisationRequest,
} from './organisation.service';

@Injectable()
export class HttpOrganisationService implements OrganisationService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  // One request per session; a failed one is forgotten, so the next caller asks again.
  private cached: Observable<OrganisationDto> | null = null;
  // A refusal or a failure reaches the dialog, which keeps the input, rather than an error page.
  private readonly writes = new HttpContext()
    .set(HANDLES_FORBIDDEN, true)
    .set(HANDLES_SERVER_ERROR, true);

  get(): Observable<OrganisationDto> {
    this.cached ??= this.http.get<OrganisationDto>(`${this.base}/organisation`).pipe(
      catchError((error: unknown) => {
        this.cached = null;
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.cached;
  }

  update(settings: UpdateOrganisationRequest): Observable<void> {
    return this.write(this.http.put<void>(`${this.base}/organisation`, settings, this.options()));
  }

  listChapters(archived = false): Observable<ChapterDto[]> {
    const query = archived ? '?archived=true' : '';
    return this.http.get<ChapterDto[]>(`${this.base}/organisation/chapters${query}`);
  }

  addChapter(name: string): Observable<ChapterDto> {
    return this.write(
      this.http.post<ChapterDto>(`${this.base}/organisation/chapters`, { name }, this.options()),
    );
  }

  renameChapter(id: string, name: string): Observable<ChapterDto> {
    return this.write(
      this.http.put<ChapterDto>(
        `${this.base}/organisation/chapters/${id}`,
        { name },
        this.options(),
      ),
    );
  }

  reorderChapters(ids: string[]): Observable<ChapterDto[]> {
    return this.write(
      this.http.put<ChapterDto[]>(
        `${this.base}/organisation/chapters/order`,
        { chapterIds: ids },
        this.options(),
      ),
    );
  }

  archiveChapter(id: string): Observable<ChapterDto> {
    return this.write(
      this.http.post<ChapterDto>(
        `${this.base}/organisation/chapters/${id}/archive`,
        null,
        this.options(),
      ),
    );
  }

  listPartnerStages(archived = false): Observable<PartnerStageDto[]> {
    const query = archived ? '?archived=true' : '';
    return this.http.get<PartnerStageDto[]>(`${this.base}/organisation/partner-stages${query}`);
  }

  addPartnerStage(name: string): Observable<PartnerStageDto> {
    return this.write(
      this.http.post<PartnerStageDto>(
        `${this.base}/organisation/partner-stages`,
        { name },
        this.options(),
      ),
    );
  }

  updatePartnerStage(id: string, change: PartnerStageChange): Observable<PartnerStageDto> {
    return this.write(
      this.http.put<PartnerStageDto>(
        `${this.base}/organisation/partner-stages/${id}`,
        change,
        this.options(),
      ),
    );
  }

  reorderPartnerStages(ids: string[]): Observable<PartnerStageDto[]> {
    return this.write(
      this.http.put<PartnerStageDto[]>(
        `${this.base}/organisation/partner-stages/order`,
        { ids },
        this.options(),
      ),
    );
  }

  archivePartnerStage(id: string): Observable<PartnerStageDto> {
    return this.write(
      this.http.post<PartnerStageDto>(
        `${this.base}/organisation/partner-stages/${id}/archive`,
        null,
        this.options(),
      ),
    );
  }

  private options() {
    return { context: this.writes };
  }

  /** The organisation is read afresh after any write. */
  private write<T>(request: Observable<T>): Observable<T> {
    return request.pipe(tap(() => (this.cached = null)));
  }
}
