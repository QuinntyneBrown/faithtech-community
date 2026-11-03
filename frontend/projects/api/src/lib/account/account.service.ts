import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** The caller's account as Settings shows it (L2-052). An account made with Google may have no password yet. */
export interface AccountDto {
  email: string;
  hasPassword: boolean;
}

/** The Account card's save: an unchanged email and an empty new password change nothing. */
export interface UpdateAccountRequest {
  email: string;
  currentPassword?: string;
  newPassword?: string;
}

/** What a save did: the address a verification link went to, and whether the password changed. */
export interface AccountUpdated {
  pendingEmail: string | null;
  passwordChanged: boolean;
}

/** Contract for the account settings API. Pages depend on ACCOUNT_SERVICE, never on HttpAccountService. */
export interface AccountService {
  get(): Observable<AccountDto>;
  /** A 400 carries the field errors (Email, CurrentPassword, NewPassword) as validation problem details. */
  update(request: UpdateAccountRequest): Observable<AccountUpdated>;
  /** Anonymous: opens from the link sent to the new address. A used or expired link is a 400. */
  confirmEmailChange(userId: string, email: string, token: string): Observable<void>;
  /** Ends every session and refresh token of the account, on every device (L2-052 AC3). */
  signOutEverywhere(): Observable<void>;
}

export const ACCOUNT_SERVICE = new InjectionToken<AccountService>('ACCOUNT_SERVICE');
