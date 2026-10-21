/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/invites/send-invite
 *   - docs/detailed-designs/invites/accept-invite
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';
import { Role, toHttpParams } from '../shared';
import { InviteDto, InviteLookupDto, InvitesService, NewAccount } from './invites.service';

@Injectable()
export class HttpInvitesService implements InvitesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/invites`;

  sendInvite(email: string, preassignedRole: Role | null = null): Observable<InviteDto> {
    return this.http.post<InviteDto>(this.base, { email, preassignedRole });
  }

  listInvites(): Observable<InviteDto[]> {
    return this.http.get<InviteDto[]>(this.base);
  }

  revokeInvite(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/revoke`, null);
  }

  getInvite(token: string): Observable<InviteLookupDto> {
    return this.http.get<InviteLookupDto>(`${this.base}/by-token`, {
      params: toHttpParams({ token }),
    });
  }

  acceptInvite(token: string, account?: NewAccount): Observable<void> {
    return this.http.post<void>(`${this.base}/accept`, {
      token,
      name: account?.name ?? null,
      password: account?.password ?? null,
    });
  }
}
