import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../config';
import {
  AccountDto,
  AccountService,
  AccountUpdated,
  UpdateAccountRequest,
} from './account.service';

@Injectable()
export class HttpAccountService implements AccountService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  get(): Observable<AccountDto> {
    return this.http.get<AccountDto>(`${this.api}/account`);
  }

  update(request: UpdateAccountRequest): Observable<AccountUpdated> {
    return this.http.put<AccountUpdated>(`${this.api}/account`, request);
  }

  confirmEmailChange(userId: string, email: string, token: string): Observable<void> {
    return this.http
      .post(`${this.api}/account/confirm-email-change`, { userId, email, token })
      .pipe(map(() => undefined));
  }

  signOutEverywhere(): Observable<void> {
    return this.http
      .post(`${this.api}/account/sign-out-everywhere`, null)
      .pipe(map(() => undefined));
  }
}
