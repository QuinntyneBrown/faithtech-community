import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../config';
import {
  ConnectLinkDto,
  ConnectLookupDto,
  ConnectResultDto,
  ConnectService,
  ConnectSignUpRequest,
} from './connect.service';

@Injectable()
export class HttpConnectService implements ConnectService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/connect`;

  getMyLink(): Observable<ConnectLinkDto> {
    return this.http.get<ConnectLinkDto>(`${this.base}/link`);
  }

  replaceMyLink(): Observable<ConnectLinkDto> {
    return this.http.post<ConnectLinkDto>(`${this.base}/link`, null);
  }

  // The token goes in the body, never the URL, so it cannot reach request logs (L2-043).
  lookUp(token: string): Observable<ConnectLookupDto> {
    return this.http.post<ConnectLookupDto>(`${this.base}/lookup`, { token });
  }

  connect(token: string): Observable<ConnectResultDto> {
    return this.http.post<ConnectResultDto>(this.base, { token });
  }

  signUp(request: ConnectSignUpRequest): Observable<void> {
    return this.http.post(`${this.base}/sign-up`, request).pipe(map(() => undefined));
  }
}
