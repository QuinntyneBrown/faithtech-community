import { Route } from '@playwright/test';

import type { MockAccount } from './mock-api';
import { holds } from './role-definitions';

export type MockStageKind = 'Open' | 'Confirmed';

/** A partner stage as the PartnerStages table holds it (docs/detailed-designs/organisations/taxonomies). */
export interface MockPartnerStage {
  id: string;
  /** Stable for the stage's life: partners, history and moves name it. */
  key: string;
  name: string;
  sortOrder: number;
  isInitial: boolean;
  kind: MockStageKind;
  archivedAtUtc: string | null;
}

/** What the stages fake reads from the rest of the fake backend. */
export interface PartnerStagesContext {
  readonly now: Date;
  /** The partners not merged away, by stage key, for the counts and the archive guard. */
  partnersOn(key: string): number;
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
 * TaxonomiesEndpoints' partner stages in the browser
 * (backend/src/FaithTech.Community.Api/Endpoints/TaxonomiesEndpoints.cs): listed for ManageOrganisationSettings or
 * ManageRoles; added, renamed, reordered, made initial, given a kind and archived for ManageOrganisationSettings, each
 * audited as taxonomy.updated (L2-144). Seeded with FaithTech's stages (L2-151).
 */
export class MockPartnerStages {
  readonly stages: MockPartnerStage[] = [
    stage('stage-lead', 'lead', 'Lead', 1, true, 'Open'),
    stage('stage-in-funnel', 'in-funnel', 'In Funnel', 2, false, 'Open'),
    stage('stage-confirmed', 'confirmed', 'Confirmed', 3, false, 'Confirmed'),
  ];

  constructor(private readonly context: PartnerStagesContext) {}

  /** Adds a stage at the end, for arranging a test; archived when asked. */
  add(name: string, options: { kind?: MockStageKind; archived?: boolean } = {}): MockPartnerStage {
    const added = stage(
      `stage-${this.stages.length + 1}`,
      keyFor(name, this.stages),
      name,
      Math.max(0, ...this.stages.map((s) => s.sortOrder)) + 1,
      false,
      options.kind ?? 'Open',
    );
    if (options.archived) added.archivedAtUtc = this.context.now.toISOString();
    this.stages.push(added);
    return added;
  }

  /** The stage with this key, archived or not. */
  byKey(key: string): MockPartnerStage | undefined {
    return this.stages.find((s) => s.key === key);
  }

  /** The stage's name as DTOs and history show it: "(archived)" once archived (L2-144 AC6). */
  nameOf(key: string): string {
    const found = this.byKey(key);
    if (!found) return key;
    return found.archivedAtUtc ? `${found.name} (archived)` : found.name;
  }

  active(): MockPartnerStage[] {
    return this.stages
      .filter((s) => !s.archivedAtUtc)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  initial(): MockPartnerStage {
    return this.active().find((s) => s.isInitial) ?? this.active()[0];
  }

  /** The active stages in order, as every stage picker reads them from GET /api/organisation. */
  options() {
    return this.active().map(({ id, key, name, isInitial, kind }) => ({
      id,
      key,
      name,
      isInitial,
      kind,
    }));
  }

  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockAccount | null | undefined,
  ): Promise<void> | undefined {
    const match = /^\/api\/organisation\/partner-stages(?:\/([^/]+)(\/archive)?)?$/.exec(
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
        ? this.stages.filter((s) => s.archivedAtUtc).sort((a, b) => a.sortOrder - b.sortOrder)
        : this.active();
      return route.fulfill({ status: 200, json: list.map((s) => this.dto(s)) });
    }
    if (!holds(caller, 'ManageOrganisationSettings')) return route.fulfill({ status: 403 });
    const audit = (summary: string, targetId: string, after: unknown) =>
      this.context.addAuditEntry({
        action: 'taxonomy.updated',
        summary,
        actorId: caller.profileId,
        actorName: caller.name,
        targetType: 'PartnerStage',
        targetId,
        after: JSON.stringify(after),
      });

    if (method === 'POST' && !id) {
      const name = String(body['name'] ?? '').trim();
      const error = nameError(name) ?? this.taken(name, null);
      if (error) return invalid(route, 'Name', error);
      const added = this.add(name);
      audit(`Added the partner stage ${name}`, added.id, {
        List: 'partner-stages',
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
        ids.some((x) => !active.some((s) => s.id === x))
      )
        return invalid(route, 'Ids', 'List every active stage once.');
      ids.forEach((x, i) => (this.stages.find((s) => s.id === x)!.sortOrder = i + 1));
      audit('Reordered the partner stages', 'partner-stages', {
        Order: this.active().map((s) => s.key),
      });
      return route.fulfill({ status: 200, json: this.active().map((s) => this.dto(s)) });
    }

    const found = id ? this.active().find((s) => s.id === id) : undefined;
    if (!found) return route.fulfill({ status: 404 });

    if (method === 'PUT' && !archive) {
      if (body['name'] !== undefined && body['name'] !== null) {
        const name = String(body['name']).trim();
        const error = nameError(name) ?? this.taken(name, found.id);
        if (error) return invalid(route, 'Name', error);
        found.name = name;
      }
      if (body['isInitial'] === true) this.active().forEach((s) => (s.isInitial = s === found));
      if (body['kind'] === 'Open' || body['kind'] === 'Confirmed') found.kind = body['kind'];
      audit(`Changed the partner stage ${found.name}`, found.id, {
        Name: found.name,
        IsInitial: found.isInitial,
        Kind: found.kind,
      });
      return route.fulfill({ status: 200, json: this.dto(found) });
    }

    if (method === 'POST' && archive) {
      const partners = this.context.partnersOn(found.key);
      const refusal =
        partners === 1
          ? '1 partner is on this stage. Move it first.'
          : partners > 1
            ? `${partners} partners are on this stage. Move them first.`
            : this.active().length === 1
              ? 'Keep at least one stage. Add another stage first.'
              : found.isInitial
                ? 'Choose another initial stage first.'
                : null;
      if (refusal) return route.fulfill({ status: 409, json: { status: 409, detail: refusal } });
      found.archivedAtUtc = this.context.now.toISOString();
      audit(`Archived the partner stage ${found.name}`, found.id, { Archived: true });
      return route.fulfill({ status: 200, json: this.dto(found) });
    }
    return undefined;
  }

  private taken(name: string, except: string | null): string | null {
    const lower = name.toLowerCase();
    return this.active().some((s) => s.id !== except && s.name.toLowerCase() === lower)
      ? `There’s already a stage called ${name}.`
      : null;
  }

  private dto(s: MockPartnerStage) {
    return {
      id: s.id,
      key: s.key,
      name: s.name,
      sortOrder: s.sortOrder,
      isInitial: s.isInitial,
      kind: s.kind,
      archived: !!s.archivedAtUtc,
      archivedAtUtc: s.archivedAtUtc,
      partnerCount: this.context.partnersOn(s.key),
    };
  }
}

function stage(
  id: string,
  key: string,
  name: string,
  sortOrder: number,
  isInitial: boolean,
  kind: MockStageKind,
): MockPartnerStage {
  return { id, key, name, sortOrder, isInitial, kind, archivedAtUtc: null };
}

/** TaxonomyRules.EntryName. */
function nameError(name: string): string | null {
  if (!name) return 'Enter a name.';
  if (name.length > MAX_NAME) return `Use ${MAX_NAME} characters or fewer.`;
  return null;
}

/** TaxonomyRules.KeyFor: lower-case, "-" for other characters, a number on a collision. */
function keyFor(name: string, stages: MockPartnerStage[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'entry';
  let candidate = base;
  for (let n = 2; stages.some((s) => s.key === candidate); n++) candidate = `${base}-${n}`;
  return candidate;
}

function invalid(route: Route, field: string, message: string) {
  return route.fulfill({ status: 400, json: { status: 400, errors: { [field]: [message] } } });
}
