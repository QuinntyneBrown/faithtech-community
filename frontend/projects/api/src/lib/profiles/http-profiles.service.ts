import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { ProfileDto, ProfilesService } from './profiles.service';

@Injectable()
export class HttpProfilesService implements ProfilesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/profiles`;

  getProfile(id: string): Observable<ProfileDto> {
    return this.http.get<ProfileDto>(`${this.base}/${encodeURIComponent(id)}`);
  }
}
