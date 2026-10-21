import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { PhotoDto, ProfileDetails, ProfileDto, ProfilesService } from './profiles.service';

@Injectable()
export class HttpProfilesService implements ProfilesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/profiles`;

  getProfile(id: string): Observable<ProfileDto> {
    return this.http.get<ProfileDto>(`${this.base}/${encodeURIComponent(id)}`);
  }

  updateProfile(id: string, details: ProfileDetails): Observable<void> {
    return this.http.put<void>(`${this.base}/${encodeURIComponent(id)}`, details);
  }

  uploadPhoto(id: string, file: File, altText: string): Observable<PhotoDto> {
    const form = new FormData();
    form.append('file', file);
    form.append('altText', altText);
    return this.http.post<PhotoDto>(this.photos(id), form);
  }

  describePhoto(id: string, photoId: string, altText: string): Observable<void> {
    return this.http.put<void>(this.photos(id, photoId), { altText });
  }

  setFeatured(id: string, photoId: string): Observable<void> {
    return this.http.put<void>(`${this.photos(id, photoId)}/featured`, null);
  }

  deletePhoto(id: string, photoId: string): Observable<void> {
    return this.http.delete<void>(this.photos(id, photoId));
  }

  private photos(id: string, photoId?: string): string {
    const base = `${this.base}/${encodeURIComponent(id)}/photos`;
    return photoId ? `${base}/${encodeURIComponent(photoId)}` : base;
  }
}
