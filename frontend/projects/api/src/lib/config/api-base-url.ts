/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 */
import { InjectionToken } from '@angular/core';

/** Base URL of the Community API, supplied by the app through provideApi(). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
