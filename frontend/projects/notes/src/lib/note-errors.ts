import { HttpErrorResponse } from '@angular/common/http';

/** Why a page was not created: the server's refusal (an unverified email, L2-085 AC12) or a lost connection. */
export function createRefusal(error: unknown, shortName: string): string {
  if (error instanceof HttpErrorResponse && error.status === 403 && error.error?.detail) {
    return String(error.error.detail);
  }
  return `We couldn’t reach ${shortName}. Try again.`;
}
