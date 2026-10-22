// Traces to: L2-001, L2-070
import { HttpErrorResponse } from '@angular/common/http';

import { signUpFieldErrors } from './sign-up-errors';

describe('signUpFieldErrors', () => {
  it('maps the validation problem onto the form fields', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        errors: { Password: ['This password has appeared in a data breach.'], Other: ['x'] },
      },
    });

    expect(signUpFieldErrors(error)).toEqual({
      password: 'This password has appeared in a data breach.',
    });
  });

  it('is null for anything that is not a field validation problem', () => {
    expect(signUpFieldErrors(new HttpErrorResponse({ status: 500 }))).toBeNull();
    expect(signUpFieldErrors(new HttpErrorResponse({ status: 400, error: {} }))).toBeNull();
    expect(signUpFieldErrors(new Error('offline'))).toBeNull();
  });
});
