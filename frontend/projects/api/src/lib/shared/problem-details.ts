/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 */
/** RFC 9457 problem details as returned by the API for 4xx/5xx responses. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}

/** 400 responses: field name -> messages. */
export interface ValidationProblemDetails extends ProblemDetails {
  errors: Record<string, string[]>;
}
