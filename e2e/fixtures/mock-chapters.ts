import { Route } from '@playwright/test';

import type { MockAccount } from './mock-api';
import { MockOrganisation } from './mock-host';
import { holds } from './role-definitions';

/** A chapter as the Chapters table holds it (docs/detailed-designs/organisations/chapters). */
export interface MockChapter {
  id: string;
  name: string;
  sortOrder: number;
  archivedAt: string | null;
}

/** What the chapters fake reads from the rest of the fake backend. */
export interface ChaptersContext {
  readonly now: Date;
  readonly host: { organisation: MockOrganisation };
  /** Profiles by id, for each chapter's member count. */
  readonly profiles: Map<string, { chapterId: string | null }>;
  addAuditEntry(entry: {
    action: string;
    summary: string;
    actorId?: string;
    actorName?: string;
    targetType?: string;
    targetId?: string;
    before?: string | null;
    after?: string | null;
  }): void;
}

const MAX_NAME = 60;

/**
 * ChaptersEndpoints in the browser (backend/src/FaithTech.Community.Api/Endpoints/ChaptersEndpoints.cs): the list
 * for ManageOrganisationSettings or ManageRoles; add, rename, reorder and archive for ManageOrganisationSettings while
 * chapters are on, with ChapterRules and the audit (L2-140 AC3 to AC5, AC7), and the tags profiles and events carry
 * (L2-141).
 */
export class MockChapters {
  readonly chapters: MockChapter[] = [];
  private counter = 0;

  constructor(private readonly context: ChaptersContext) {}

  /** A chapter as the table holds it, added at the end unless archived. */
  add(name: string, archived = false): MockChapter {
    const chapter: MockChapter = {
      id: `chapter-${++this.counter}`,
      name,
      sortOrder: this.chapters.length,
      archivedAt: archived ? this.context.now.toISOString() : null,
    };
    this.chapters.push(chapter);
    return chapter;
  }

  /** The chapter called `name`, added at the end when the organisation has none; for arranging tags. */
  named(name: string): MockChapter {
    return this.chapters.find((c) => c.name.toUpperCase() === name.toUpperCase()) ?? this.add(name);
  }

  /** The tag's name as DTOs carry it: null for no tag, and for every tag while chapters are off. */
  nameOf(id: string | null | undefined): string | null {
    if (!id || !this.context.host.organisation.chapterLabel) return null;
    return this.chapters.find((c) => c.id === id)?.name ?? null;
  }

  /**
   * The tag a profile or event save keeps (L2-141): the current one while chapters are off; otherwise the pick,
   * which must be active unless it is the current tag (L2-140 AC5).
   */
  pick(chosen: unknown, current: string | null): { chapterId: string | null } | { error: string } {
    const label = this.context.host.organisation.chapterLabel;
    if (!label) return { chapterId: current };
    const id = typeof chosen === 'string' && chosen ? chosen : null;
    if (id && id !== current && !this.active().some((c) => c.id === id))
      return { error: `Choose a ${label.singular.toLowerCase()} from the list.` };
    return { chapterId: id };
  }

  /** The active chapters in order, as every picker reads them from GET /api/organisation. */
  options(): { id: string; name: string }[] {
    if (!this.context.host.organisation.chapterLabel) return [];
    return this.active().map(({ id, name }) => ({ id, name }));
  }

  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockAccount | null | undefined,
  ): Promise<void> | undefined {
    const match = /^\/api\/organisation\/chapters(?:\/([^/]+)(\/archive)?)?$/.exec(url.pathname);
    if (!match) return undefined;
    if (!caller) return route.fulfill({ status: 401 });
    const [, id, archive] = match;

    if (method === 'GET' && !id) {
      if (!holds(caller, 'ManageOrganisationSettings') && !holds(caller, 'ManageRoles'))
        return route.fulfill({ status: 403 });
      const archived = url.searchParams.get('archived') === 'true';
      const list = archived ? this.chapters.filter((c) => c.archivedAt) : this.active();
      return route.fulfill({ status: 200, json: list.map((c) => this.dto(c)) });
    }
    if (!holds(caller, 'ManageOrganisationSettings')) return route.fulfill({ status: 403 });
    const label = this.context.host.organisation.chapterLabel;
    if (!label)
      return route.fulfill({
        status: 409,
        json: { status: 409, detail: 'Turn chapters on in General first.' },
      });
    const actor = { actorId: caller.profileId, actorName: caller.name };

    if (method === 'PUT' && id === 'order') {
      const ids = (body['chapterIds'] as string[] | undefined) ?? [];
      const active = this.active();
      if (
        ids.length !== active.length ||
        new Set(ids).size !== ids.length ||
        ids.some((x) => !active.some((c) => c.id === x))
      )
        return invalid(route, 'ChapterIds', 'List every active chapter once.');
      ids.forEach((x, i) => (this.chapters.find((c) => c.id === x)!.sortOrder = i));
      this.context.addAuditEntry({
        action: 'chapter.reordered',
        summary: `Reordered the ${label.plural.toLowerCase()}`,
        targetType: 'Organisation',
        ...actor,
      });
      return route.fulfill({ status: 200, json: this.active().map((c) => this.dto(c)) });
    }

    const chapter = id ? this.active().find((c) => c.id === id) : undefined;
    if (id && !chapter) return route.fulfill({ status: 404 });

    if (method === 'POST' && chapter && archive) {
      chapter.archivedAt = this.context.now.toISOString();
      this.context.addAuditEntry({
        action: 'chapter.archived',
        summary: `Archived ${chapter.name}`,
        targetType: 'Chapter',
        targetId: chapter.id,
        ...actor,
      });
      return route.fulfill({ status: 200, json: this.dto(chapter) });
    }
    if (!((method === 'POST' && !id) || (method === 'PUT' && chapter && !archive)))
      return route.fulfill({ status: 405 });

    const name = String(body['name'] ?? '').trim();
    if (!name) return invalid(route, 'Name', 'Enter a name.');
    if (name.length > MAX_NAME)
      return invalid(route, 'Name', `Use ${MAX_NAME} characters or fewer for the name.`);
    if (this.active().some((c) => c !== chapter && c.name.toUpperCase() === name.toUpperCase()))
      return invalid(
        route,
        'Name',
        `There’s already a ${label.singular.toLowerCase()} called ${name}.`,
      );

    if (chapter) {
      const before = chapter.name;
      chapter.name = name;
      this.context.addAuditEntry({
        action: 'chapter.updated',
        summary: `Renamed ${before} to ${name}`,
        targetType: 'Chapter',
        targetId: chapter.id,
        before: JSON.stringify({ name: before }),
        after: JSON.stringify({ name }),
        ...actor,
      });
      return route.fulfill({ status: 200, json: this.dto(chapter) });
    }
    const added = this.add(name);
    added.sortOrder =
      Math.max(
        -1,
        ...this.active()
          .filter((c) => c !== added)
          .map((c) => c.sortOrder),
      ) + 1;
    this.context.addAuditEntry({
      action: 'chapter.added',
      summary: `Added ${name}`,
      targetType: 'Chapter',
      targetId: added.id,
      after: JSON.stringify({ name }),
      ...actor,
    });
    return route.fulfill({ status: 201, json: this.dto(added) });
  }

  private active(): MockChapter[] {
    return this.chapters
      .filter((c) => !c.archivedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  private dto(c: MockChapter) {
    return {
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      archived: !!c.archivedAt,
      memberCount: [...this.context.profiles.values()].filter((p) => p.chapterId === c.id).length,
    };
  }
}

function invalid(route: Route, field: string, message: string) {
  return route.fulfill({
    status: 400,
    json: { title: 'Invalid', status: 400, errors: { [field]: [message] } },
  });
}
