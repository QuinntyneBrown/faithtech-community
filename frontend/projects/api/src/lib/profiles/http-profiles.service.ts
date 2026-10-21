/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/profiles/view-profile
 *   - docs/detailed-designs/profiles/edit-own-profile
 *   - docs/detailed-designs/profiles/manage-profile-photos
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { PhotoDto, ProfileDto, ProfilesService } from './profiles.service';

@Injectable()
export class HttpProfilesService implements ProfilesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/profiles`;

  getProfile(id: string): Observable<ProfileDto> {
    return this.http.get<ProfileDto>(`${this.base}/${id}`);
  }

  updateProfile(id: string, changes: { name: string }): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, changes);
  }

  uploadPhoto(id: string, file: File, altText: string): Observable<PhotoDto> {
    // TODO(slice): the design does not name the multipart fields; "file" and "altText" are assumed.
    const form = new FormData();
    form.append('file', file);
    form.append('altText', altText);
    return this.http.post<PhotoDto>(`${this.base}/${id}/photos`, form);
  }

  setFeatured(id: string, photoId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/photos/${photoId}/featured`, null);
  }

  deletePhoto(id: string, photoId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/photos/${photoId}`);
  }
}
