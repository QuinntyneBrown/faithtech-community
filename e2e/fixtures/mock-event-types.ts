import { Route } from '@playwright/test';

import type { MockAccount } from './mock-api';
import { holds } from './role-definitions';

/** An event type as the EventTypes table holds it (docs/detailed-designs/organisations/taxonomies). */
export interface MockEventType {
  id: string;
  /** Stable for the type's life: events and the type= filter name it. */
  key: string;
  name: string;
  sortOrder: number;
  archivedAtUtc: string | null;
}

/** What the event types fake reads from the rest of the fake backend. */
export interface EventTypesContext {
  readonly now: Date;
  /** How many events are of the type with this key, for the counts. */
  eventsOf(key: string): number;
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

/**
 * TaxonomiesEndpoints' event types in the browser
 * (backend/src/FaithTech.Community.Api/Endpoints/TaxonomiesEndpoints.cs): listed for ManageOrganisationSettings or
 * ManageRoles; added, renamed, reordered and archived for ManageOrganisationSettings, each audited as taxonomy.updated
 * (L2-145). The last active type stays. Seeded with FaithTech's types (L2-151 AC3).
 */
export class MockEventTypes {
  readonly types: MockEventType[] = [
    type('type-gathering', 'gathering', 'Gathering', 1),
    type('type-builders-night', 'builders-night', 'Builders night', 2),
    type('type-hackathon', 'hackathon', 'Hackathon', 3),
    type('type-prayer-and-planning', 'prayer-and-planning', 'Prayer & planning', 4),
    type('type-panel', 'panel', 'Panel', 5),
  ];

  constructor(private readonly context: EventTypesContext) {}

  /** Adds a type at the end, for arranging a test; archived when asked. */
  add(name: string, options: { archived?: boolean } = {}): MockEventType {
    const added = type(
      `type-${this.types.length + 1}`,
      keyFor(name, this.types),
      name,
      Math.max(0, ...this.types.map((t) => t.sortOrder)) + 1,
    );
    if (options.archived) added.archivedAtUtc = this.context.now.toISOString();
    this.types.push(added);
    return added;
  }

  /** The type with this key, archived or not. */
  byKey(key: string): MockEventType | undefined {
    return this.types.find((t) => t.key === key);
  }

  /** The type's current name, shown on its events even once archived (L2-145 AC4). */
  nameOf(key: string): string {
    return this.byKey(key)?.name ?? key;
  }

  active(): MockEventType[] {
    return this.types
      .filter((t) => !t.archivedAtUtc)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  /** SaveEventHandler: an active type, or the event's current one on edit (L2-145 AC2). */
  allows(key: unknown, current: string | null = null): boolean {
    return this.active().some((t) => t.key === key) || (current !== null && key === current);
  }

  /** The active types in order, as the event form and the type filter read them from GET /api/organisation. */
  options() {
    return this.active().map(({ id, key, name }) => ({ id, key, name }));
  }

  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockAccount | null | undefined,
  ): Promise<void> | undefined {
    const match = /^\/api\/organisation\/event-types(?:\/([^/]+)(\/archive)?)?$/.exec(url.pathname);
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
        targetType: 'EventType',
        targetId,
        after: JSON.stringify(after),
      });

    if (method === 'POST' && !id) {
      const name = String(body['name'] ?? '').trim();
      const error = nameError(name) ?? this.taken(name, null);
      if (error) return invalid(route, 'Name', error);
      const added = this.add(name);
      audit(`Added the event type ${name}`, added.id, { List: 'event-types', Key: added.key });
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
      audit('Reordered the event types', 'event-types', {
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
      audit(`Renamed the event type ${name}`, found.id, { Name: name });
      return route.fulfill({ status: 200, json: this.dto(found) });
    }

    if (method === 'POST' && archive) {
      if (this.active().length === 1)
        return route.fulfill({
          status: 409,
          json: { status: 409, detail: 'Keep at least one type. Add another type first.' },
        });
      found.archivedAtUtc = this.context.now.toISOString();
      audit(`Archived the event type ${found.name}`, found.id, { Archived: true });
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

  private dto(t: MockEventType) {
    return {
      id: t.id,
      key: t.key,
      name: t.name,
      sortOrder: t.sortOrder,
      archived: !!t.archivedAtUtc,
      archivedAtUtc: t.archivedAtUtc,
      eventCount: this.context.eventsOf(t.key),
    };
  }
}

function type(id: string, key: string, name: string, sortOrder: number): MockEventType {
  return { id, key, name, sortOrder, archivedAtUtc: null };
}

/** TaxonomyRules.EntryName. */
function nameError(name: string): string | null {
  if (!name) return 'Enter a name.';
  if (name.length > MAX_NAME) return `Use ${MAX_NAME} characters or fewer.`;
  return null;
}

/** TaxonomyRules.KeyFor: lower-case, "-" for other characters, a number on a collision. */
function keyFor(name: string, types: MockEventType[]): string {
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
