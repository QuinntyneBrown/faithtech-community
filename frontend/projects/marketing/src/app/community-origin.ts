import { InjectionToken } from '@angular/core';

/** Origin of the community app, which owns the session and hosts the API (ADR 0017). */
export const COMMUNITY_ORIGIN = new InjectionToken<string>('COMMUNITY_ORIGIN');
