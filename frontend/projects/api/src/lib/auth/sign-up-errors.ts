import { HttpErrorResponse } from '@angular/common/http';

import { SignUpRequest } from './auth.service';

/** The sign-up fields the API can reject, with the first message for each. */
export type SignUpFieldErrors = Partial<Record<keyof SignUpRequest, string>>;

const FIELDS: (keyof SignUpRequest)[] = ['name', 'email', 'password'];

/**
 * Maps the API's validation problem details (PascalCase keys) onto the sign-up form's fields, or
 * null when the error is not a 400 that names any of them (the API could not be reached, say).
 */
export function signUpFieldErrors(error: unknown): SignUpFieldErrors | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  const mapped: SignUpFieldErrors = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = key.toLowerCase() as keyof SignUpRequest;
    if (FIELDS.includes(field) && messages.length) mapped[field] = messages[0];
  }
  return Object.keys(mapped).length ? mapped : null;
}
