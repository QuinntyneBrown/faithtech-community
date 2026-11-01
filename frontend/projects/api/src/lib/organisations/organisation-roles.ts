import { Injectable, inject, signal } from '@angular/core';

import { ORGANISATION_SERVICE, OrganisationRole } from './organisation.service';

/**
 * The host organisation's role definitions that are not archived, in its order, read once from GET
 * /api/organisation (L2-136 AC8). Pickers offer these roles and labels name a role key by its definition, so no page
 * names a role of its own (ADR 0033). Until the definitions arrive, or when they cannot be read, a key labels itself.
 */
@Injectable({ providedIn: 'root' })
export class OrganisationRoles {
  private readonly organisation = inject(ORGANISATION_SERVICE, { optional: true });
  private readonly loaded = signal<readonly OrganisationRole[]>([]);

  /** The roles, in the organisation's order. */
  readonly roles = this.loaded.asReadonly();

  constructor() {
    this.organisation?.get().subscribe({
      next: (organisation) => this.loaded.set(organisation.roles),
      error: () => undefined,
    });
  }

  /** The organisation's name for the role with this key; the key itself when no definition has it. */
  label(key: string): string {
    return this.loaded().find((r) => r.key === key)?.name ?? key;
  }
}
