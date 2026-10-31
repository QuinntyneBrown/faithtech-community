import { InjectionToken, Signal, signal } from '@angular/core';

/** The organisation's names, for components whose copy names the product (L2-134 AC1). */
export interface OrganisationNameSource {
  readonly name: Signal<string>;
  readonly shortName: Signal<string>;
}

/**
 * Provided by each application from the API's organisation (the community app's OrganisationNames); the library
 * itself never names an organisation. Without a provider the copy reads a neutral "Community".
 */
export const ORGANISATION_NAMES = new InjectionToken<OrganisationNameSource>('ORGANISATION_NAMES', {
  providedIn: 'root',
  factory: () => ({ name: signal('Community'), shortName: signal('Community') }),
});
