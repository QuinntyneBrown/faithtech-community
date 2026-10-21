/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Test-only helper; deliberately not exported from the public API.
 */
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';

import { API_BASE_URL } from '../config';

export function apiTestProviders(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: API_BASE_URL, useValue: '/api' },
  ];
}
