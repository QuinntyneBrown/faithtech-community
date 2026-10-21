/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/platform/error-and-system-pages
 */
import { HttpErrorResponse } from '@angular/common/http';

import { ValidationProblemDetails } from '../shared';

/** Returns the problem-details body of an HTTP error, or null for any other error. */
export function problemDetails(error: unknown): ValidationProblemDetails | null {
  if (error instanceof HttpErrorResponse || (isRecord(error) && 'status' in error)) {
    const body = (error as { error?: unknown }).error;
    return isRecord(body) ? (body as unknown as ValidationProblemDetails) : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
