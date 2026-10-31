import { Route } from '@playwright/test';

import type { MockAccount } from './mock-api';
import { holds } from './role-definitions';

/** A resource type as the ResourceTypes table holds it (docs/detailed-designs/organisations/taxonomies). */
export interface MockResourceType {
  id: string;
  /** Stable for the type's life: resources, the type= filter and the upload guess name it. */
  key: string;
  name: string;
  sortOrder: number;
  archivedAtUtc: string | null;
}

/** What the resource types fake reads from the rest of the fake backend. */
export interface ResourceTypesContext {
  readonly now: Date;
  /** How many resources that are not archived are of the type with this key, for the counts. */
  resourcesOf(key: string): number;
  addAuditEntry(entry: {
    action: string;
    summary: string;
    actorId?: string;
    actorName?: string;
    targetType?: string;
    targetId?: string;
    after?: string | null;
  }): void;
}

const MAX_NAME = 40;
/** The fallback type every organisation keeps (L2-146 AC1, AC3). */
export const OTHER_KEY = 'other';

/**
 * TaxonomiesEndpoints' resource types in the browser
 * (backend/src/FaithTech.Community.Api/Endpoints/TaxonomiesEndpoints.cs): listed for ManageOrganisationSettings or
 * ManageRoles; added, renamed, reordered and archived for ManageOrganisationSettings, each audited as taxonomy.updated
 * (L2-146). The type keyed other is never archived. Seeded with FaithTech's types (L2-151 AC3).
 */
export class MockResourceTypes {
  readonly types: MockResourceType[] = [
    type('resource-type-deck', 'deck', 'Deck', 1),
    type('resource-type-logo', 'logo', 'Logo', 2),
    type('resource-type-image', 'image', 'Image', 3),
    type('resource-type-training', 'training', 'Training', 4),
    type('resource-type-template', 'template', 'Template', 5),
    type('resource-type-document', 'document', 'Document', 6),
    type('resource-type-other', OTHER_KEY, 'Other', 7),
  ];

  constructor(private readonly context: ResourceTypesContext) {}

  /** Adds a type at the end, for arranging a test; archived when asked. */
  add(name: string, options: { archived?: boolean } = {}): MockResourceType {
    const added = type(
      `resource-type-${this.types.length + 1}`,
      keyFor(name, this.types),
      name,
      Math.max(0, ...this.types.map((t) => t.sortOrder)) + 1,
    );
    if (options.archived) added.archivedAtUtc = this.context.now.toISOString();
    this.types.push(added);
    return added;
  }

  /** The type with this key, archived or not. */
  byKey(key: string): MockResourceType | undefined {
    return this.types.find((t) => t.key === key);
  }

  /** The type's current name, shown on its resources even once archived (L2-146 AC4). */
  nameOf(key: string): string {
    return this.byKey(key)?.name ?? key;
  }

  active(): MockResourceType[] {
    return this.types
      .filter((t) => !t.archivedAtUtc)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  /** ResourceFieldRules: an active type, or the resource's current one on edit (L2-146 AC2). */
  allows(key: unknown, current: string | null = null): boolean {
    return this.active().some((t) => t.key === key) || (current !== null && key === current);
  }

  /** ResourceTypeResolver: the active type with the guessed key, else other (L2-146 AC3). */
  resolveGuess(key: string): string {
    return this.active().some((t) => t.key === key) ? key : OTHER_KEY;
  }

  /** The active types in order, as the dialogs and the filter read them from GET /api/organisation. */
  options() {
    return this.active().map(({ id, key, name }) => ({ id, key, name }));
  }

  /** The archived types, for "Show archived types" (L2-146 AC4). */
  archivedOptions() {
    return this.types
      .filter((t) => t.archivedAtUtc)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ id, key, name }) => ({ id, key, name }));
  }

  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockAccount | null | undefined,
  ): Promise<void> | undefined {
    const match = /^\/api\/organisation\/resource-types(?:\/([^/]+)(\/archive)?)?$/.exec(
      url.pathname,
    );
    if (!match) return undefined;
    if (!caller) return route.fulfill({ status: 401 });
    const [, id, archive] = match;

    if (method === 'GET' && !id) {
      if (!holds(caller, 'ManageOrganisationSettings') && !holds(caller, 'ManageRoles'))
        return route.fulfill({ status: 403 });
      const archived = url.searchParams.get('archived') === 'true';
      const list = archived
        ? this.types.filter((t) => t.archivedAtUtc).sort((a, b) => a.sortOrder - b.sortOrder)
        : this.active();
      return route.fulfill({ status: 200, json: list.map((t) => this.dto(t)) });
    }
    if (!holds(caller, 'ManageOrganisationSettings')) return route.fulfill({ status: 403 });
    const audit = (summary: string, targetId: string, after: unknown) =>
      this.context.addAuditEntry({
        action: 'taxonomy.updated',
        summary,
        actorId: caller.profileId,
        actorName: caller.name,
        targetType: 'ResourceType',
        targetId,
        after: JSON.stringify(after),
      });

    if (method === 'POST' && !id) {
      const name = String(body['name'] ?? '').trim();
      const error = nameError(name) ?? this.taken(name, null);
      if (error) return invalid(route, 'Name', error);
      const added = this.add(name);
      audit(`Added the resource type ${name}`, added.id, {
        List: 'resource-types',
        Key: added.key,
      });
      return route.fulfill({ status: 201, json: this.dto(added) });
    }

    if (method === 'PUT' && id === 'order') {
      const ids = (body['ids'] as string[] | undefined) ?? [];
      const active = this.active();
      if (
        ids.length !== active.length ||
        new Set(ids).size !== ids.length ||
        ids.some((x) => !active.some((t) => t.id === x))
      )
        return invalid(route, 'Ids', 'List every active type once.');
      ids.forEach((x, i) => (this.types.find((t) => t.id === x)!.sortOrder = i + 1));
      audit('Reordered the resource types', 'resource-types', {
        Order: this.active().map((t) => t.key),
      });
      return route.fulfill({ status: 200, json: this.active().map((t) => this.dto(t)) });
    }

    const found = id ? this.active().find((t) => t.id === id) : undefined;
    if (!found) return route.fulfill({ status: 404 });

    if (method === 'PUT' && !archive) {
      const name = String(body['name'] ?? '').trim();
      const error = nameError(name) ?? this.taken(name, found.id);
      if (error) return invalid(route, 'Name', error);
      found.name = name;
      audit(`Renamed the resource type ${name}`, found.id, { Name: name });
      return route.fulfill({ status: 200, json: this.dto(found) });
    }

    if (method === 'POST' && archive) {
      if (found.key === OTHER_KEY)
        return route.fulfill({
          status: 409,
          json: {
            status: 409,
            detail: `${found.name} is where uploads go when their type can’t be guessed, so it can’t be archived.`,
          },
        });
      found.archivedAtUtc = this.context.now.toISOString();
      audit(`Archived the resource type ${found.name}`, found.id, { Archived: true });
      return route.fulfill({ status: 200, json: this.dto(found) });
    }
    return undefined;
  }

  private taken(name: string, except: string | null): string | null {
    const lower = name.toLowerCase();
    return this.active().some((t) => t.id !== except && t.name.toLowerCase() === lower)
      ? `There’s already a type called ${name}.`
      : null;
  }

  private dto(t: MockResourceType) {
    return {
      id: t.id,
      key: t.key,
      name: t.name,
      sortOrder: t.sortOrder,
      archived: !!t.archivedAtUtc,
      archivedAtUtc: t.archivedAtUtc,
      resourceCount: this.context.resourcesOf(t.key),
      canArchive: t.key !== OTHER_KEY,
    };
  }
}

function type(id: string, key: string, name: string, sortOrder: number): MockResourceType {
  return { id, key, name, sortOrder, archivedAtUtc: null };
}

/** TaxonomyRules.EntryName. */
function nameError(name: string): string | null {
  if (!name) return 'Enter a name.';
  if (name.length > MAX_NAME) return `Use ${MAX_NAME} characters or fewer.`;
  return null;
}

/** TaxonomyRules.KeyFor: lower-case, "-" for other characters, a number on a collision. */
function keyFor(name: string, types: MockResourceType[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'entry';
  let candidate = base;
  for (let n = 2; types.some((t) => t.key === candidate); n++) candidate = `${base}-${n}`;
  return candidate;
}

function invalid(route: Route, field: string, message: string) {
  return route.fulfill({ status: 400, json: { status: 400, errors: { [field]: [message] } } });
}
