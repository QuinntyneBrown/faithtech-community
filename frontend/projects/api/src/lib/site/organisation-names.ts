import { Injectable, computed, inject } from '@angular/core';

import { AUTH_SERVICE } from '../auth/auth.service';
import { SITE_SERVICE } from './site.service';

/** Shown only when neither /api/me nor /api/site could be read, so no copy ever names a fixed organisation. */
export const FALLBACK_ORGANISATION_NAME = 'Community';

/**
 * The organisation's name and short name for copy that names the product (L2-134 AC1): from the signed-in member's
 * /api/me when there is one, otherwise from GET /api/site, which pages read before sign-in.
 */
@Injectable({ providedIn: 'root' })
export class OrganisationNames {
  private readonly auth = inject(AUTH_SERVICE, { optional: true });
  private readonly site = inject(SITE_SERVICE, { optional: true });

  readonly name = computed(
    () =>
      this.auth?.currentUser?.()?.organisation?.name ??
      this.site?.site()?.name ??
      FALLBACK_ORGANISATION_NAME,
  );

  readonly shortName = computed(
    () =>
      this.auth?.currentUser?.()?.organisation?.shortName ??
      this.site?.site()?.shortName ??
      FALLBACK_ORGANISATION_NAME,
  );

  /** "We couldn’t reach {short name}." followed by what happened, for failures the server never answered. */
  unreachable(then = 'Try again.'): string {
    return `We couldn’t reach ${this.shortName()}. ${then}`;
  }
}
