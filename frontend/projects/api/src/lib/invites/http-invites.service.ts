import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { HANDLES_FORBIDDEN } from '../errors';
import { toHttpParams } from '../shared';
import {
  InviteDto,
  InviteLookupDto,
  InvitePage,
  InvitesService,
  NewAccount,
  SendInviteRequest,
} from './invites.service';

@Injectable()
export class HttpInvitesService implements InvitesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/invites`;
  // The send dialog shows a 403 refusal (role, unverified email) itself.
  private readonly context = new HttpContext().set(HANDLES_FORBIDDEN, true);

  sendInvite(request: SendInviteRequest): Observable<InviteDto> {
    return this.http.post<InviteDto>(this.base, request, { context: this.context });
  }

  listInvites(after?: string | null): Observable<InvitePage> {
    return this.http.get<InvitePage>(this.base, { params: toHttpParams({ after }) });
  }

  resendInvite(id: string): Observable<InviteDto> {
    return this.http.post<InviteDto>(`${this.base}/${encodeURIComponent(id)}/resend`, null, {
      context: this.context,
    });
  }

  revokeInvite(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${encodeURIComponent(id)}/revoke`, null);
  }

  getInvite(token: string): Observable<InviteLookupDto> {
    // The token is a credential: it goes in the body so it never appears in a URL or request log.
    return this.http.post<InviteLookupDto>(`${this.base}/lookup`, { token });
  }

  acceptInvite(token: string, account?: NewAccount): Observable<void> {
    return this.http.post<void>(`${this.base}/accept`, {
      token,
      name: account?.name ?? null,
      password: account?.password ?? null,
    });
  }
}
