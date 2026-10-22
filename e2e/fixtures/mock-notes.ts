import { Route } from '@playwright/test';

import type { MockAccount, MockProfile } from './mock-api';
import type { MockNotifications } from './mock-notifications';

export type MockNoteVisibility = 'Private' | 'Shared' | 'Global';

export interface MockSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
  pageId?: string;
}

export interface MockBlock {
  id: string;
  type: string;
  text?: MockSpan[];
  checked?: boolean;
  icon?: string;
  url?: string;
  caption?: string;
  imageId?: string;
  alt?: string;
}

/** A page as the NotePages table holds it (ADR 0023). */
export interface MockNote {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  ownerId: string;
  visibility: MockNoteVisibility;
  memberIds: string[];
  roles: string[];
  blocks: MockBlock[];
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedById: string;
  archivedAt: string | null;
}

/** What the notes fake reads from the rest of the fake backend. */
export interface NotesContext {
  readonly accounts: Map<string, MockAccount>;
  readonly profiles: Map<string, MockProfile>;
  readonly notifications: MockNotifications;
  readonly now: Date;
}

const PAGE_SIZE = 25;
const DAY = 24 * 60 * 60 * 1000;
const MAX_TITLE = 200;
const TYPES = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulleted',
  'numbered',
  'todo',
  'quote',
  'callout',
  'code',
  'divider',
  'image',
  'link',
];

/**
 * NotesEndpoints in the browser (backend/src/FaithTech.Community.Api/Endpoints/NotesEndpoints.cs, ADR 0025):
 * visibility in every read (Private to the owner and System Admin, Shared to its members and the current holders
 * of its roles, Global to every member), owner-only writes, and a 409 when a save is based on an old version.
 */
export class MockNotes {
  readonly pages: MockNote[] = [];
  private counter = 0;

  constructor(private readonly context: NotesContext) {}

  /** A page as the table holds it; give `daysAgo` to age its last edit. */
  add(note: Partial<MockNote> & { title: string; ownerId: string }, daysAgo = 0): MockNote {
    const at = new Date(this.context.now.getTime() - daysAgo * DAY).toISOString();
    const full: MockNote = {
      id: `note-${++this.counter}`,
      icon: null,
      parentId: null,
      visibility: 'Private',
      memberIds: [],
      roles: [],
      blocks: [],
      version: 1,
      createdAt: at,
      updatedAt: at,
      updatedById: note.ownerId,
      archivedAt: null,
      ...note,
    };
    this.pages.push(full);
    return full;
  }

  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockAccount | null,
  ): Promise<void> | undefined {
    const match = /^\/api\/notes(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?$/.exec(url.pathname);
    if (!match) return undefined;
    if (!caller) return route.fulfill({ status: 401 });
    const [, id] = match;

    if (!id) {
      if (method === 'GET') return this.list(route, url, caller);
      if (method === 'POST') return this.create(route, caller, body);
    }

    const note = this.find(id, caller);
    if (!note) return route.fulfill({ status: 404 });
    const admin = caller.roles.includes('SystemAdmin');
    const canChange = note.ownerId === caller.profileId || admin;
    if (method === 'GET' && !match[2]) return this.json(route, 200, this.dto(note, caller));
    if (method === 'PUT' && !match[2]) {
      if (!canChange) return route.fulfill({ status: 403 });
      return this.save(route, note, caller, body);
    }
    return route.fulfill({ status: 405 });
  }

  /** Active pages the caller may open, recently edited first. */
  visible(caller: MockAccount): MockNote[] {
    return this.pages
      .filter((n) => !n.archivedAt && this.mayOpen(n, caller))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  mayOpen(n: MockNote, caller: MockAccount): boolean {
    return (
      n.visibility === 'Global' ||
      n.ownerId === caller.profileId ||
      caller.roles.includes('SystemAdmin') ||
      (n.visibility === 'Shared' && this.sharedWith(n, caller))
    );
  }

  private sharedWith(n: MockNote, caller: MockAccount): boolean {
    return n.memberIds.includes(caller.profileId) || n.roles.some((r) => caller.roles.includes(r));
  }

  private find(id: string, caller: MockAccount): MockNote | undefined {
    const n = this.pages.find((x) => x.id === id);
    if (!n) return undefined;
    if (n.archivedAt)
      return n.ownerId === caller.profileId || caller.roles.includes('SystemAdmin') ? n : undefined;
    return this.mayOpen(n, caller) ? n : undefined;
  }

  private list(route: Route, url: URL, caller: MockAccount) {
    const words = (url.searchParams.get('q') ?? '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const owner = url.searchParams.get('owner') ?? 'all';
    const page = Number(url.searchParams.get('page') ?? '1');
    if (!['all', 'mine', 'shared'].includes(owner))
      return this.invalid(route, { owner: ['Choose all, mine or shared.'] });
    const rows = this.visible(caller)
      .filter((n) => owner !== 'mine' || n.ownerId === caller.profileId)
      .filter(
        (n) =>
          owner !== 'shared' ||
          (n.ownerId !== caller.profileId &&
            n.visibility === 'Shared' &&
            this.sharedWith(n, caller)),
      )
      .filter((n) => words.every((w) => this.text(n).includes(w)));
    const items = rows
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((n) => this.summary(n, caller));
    return this.json(route, 200, { items, page, pageSize: PAGE_SIZE, totalCount: rows.length });
  }

  /** The searchable text: title and the text of every block, never linked pages' titles (L2-096 AC3). */
  text(n: MockNote): string {
    const blocks = n.blocks.map((b) =>
      [...(b.text ?? []).filter((s) => !s.pageId).map((s) => s.text), b.caption ?? ''].join(''),
    );
    return [n.title, ...blocks].join(' ').toLowerCase();
  }

  private create(route: Route, caller: MockAccount, body: Record<string, unknown>) {
    if (!caller.verified)
      return this.json(route, 403, {
        status: 403,
        detail: 'Verify your email before creating pages.',
      });
    const title = typeof body['title'] === 'string' ? body['title'].trim() : '';
    if (title.length > MAX_TITLE)
      return this.invalid(route, { Title: ['Use 200 characters or fewer for the title.'] });
    const note = this.add({ title, ownerId: caller.profileId });
    return this.json(route, 201, this.dto(note, caller));
  }

  /** The plain text of each block, for assertions. */
  texts(n: MockNote): string[] {
    return n.blocks.map((b) => (b.text ?? []).map((s) => s.text).join(''));
  }

  /** A whole-page save (L2-086 AC8). */
  private save(route: Route, n: MockNote, caller: MockAccount, body: Record<string, unknown>) {
    const blocks = (body['blocks'] as MockBlock[] | undefined) ?? [];
    const title = String(body['title'] ?? '').trim();
    if (blocks.length > 500)
      return this.invalid(route, {
        Blocks: ['A page holds up to 500 blocks. Start a new page inside this one.'],
      });
    if (title.length > MAX_TITLE)
      return this.invalid(route, { Title: ['Use 200 characters or fewer for the title.'] });
    const refused = blocks.findIndex((b) => this.problem(b));
    if (refused >= 0)
      return this.invalid(route, { [`Blocks[${refused}]`]: [this.problem(blocks[refused])!] });
    n.title = title;
    n.icon = (body['icon'] as string | null) ?? null;
    n.blocks = blocks.map((b) => this.stored(b));
    n.version += 1;
    n.updatedAt = this.context.now.toISOString();
    n.updatedById = caller.profileId;
    return this.json(route, 200, { version: n.version, updatedAt: n.updatedAt });
  }

  /** The server's block rules (NoteBlocksValidator): known types, https link cards, captions. */
  private problem(b: MockBlock): string | null {
    if (!TYPES.includes(b.type)) return 'Choose a block type from the list.';
    if (b.type === 'link' && !/^https:\/\/[^\s/]+/.test(b.url ?? ''))
      return 'Use a link that starts with https://.';
    if ((b.caption ?? '').length > 200) return 'Use 200 characters or fewer for the caption.';
    return null;
  }

  /** A block as the server stores it: nulls dropped. */
  private stored(b: MockBlock): MockBlock {
    return JSON.parse(JSON.stringify(b, (_k, v) => (v === null ? undefined : v))) as MockBlock;
  }

  private summary(n: MockNote, caller: MockAccount) {
    return {
      id: n.id,
      title: n.title,
      icon: n.icon,
      ownerId: n.ownerId,
      ownerName: this.name(n.ownerId),
      isOwn: n.ownerId === caller.profileId,
      visibility: n.visibility,
      sharedWithYou:
        n.ownerId !== caller.profileId && n.visibility === 'Shared' && this.sharedWith(n, caller),
      updatedAt: n.updatedAt,
      updatedByName: this.name(n.updatedById),
    };
  }

  private dto(n: MockNote, caller: MockAccount) {
    const own = n.ownerId === caller.profileId;
    const admin = caller.roles.includes('SystemAdmin');
    const sharedVia =
      own || n.visibility !== 'Shared'
        ? null
        : n.memberIds.includes(caller.profileId)
          ? 'you'
          : (n.roles.find((r) => caller.roles.includes(r)) ?? null);
    return {
      ...this.summary(n, caller),
      parentId: n.parentId,
      sharedWithYou: sharedVia !== null,
      sharedVia,
      audience: {
        members: n.memberIds.map((id) => ({
          id,
          name: this.name(id),
          city: this.context.profiles.get(id)?.homeCity ?? null,
        })),
        roles: n.roles.map((role) => ({
          role,
          count: [...this.context.accounts.values()].filter((a) => a.roles.includes(role)).length,
        })),
      },
      blocks: n.blocks,
      version: n.version,
      createdAt: n.createdAt,
      archivedAt: n.archivedAt,
      canEdit: own || admin,
      isAdminView: !own && admin,
      breadcrumb: [],
      children: [],
      backlinks: [],
    };
  }

  name(profileId: string): string {
    return this.context.profiles.get(profileId)?.name ?? 'A former member';
  }

  private invalid(route: Route, errors: Record<string, string[]>) {
    return this.json(route, 400, {
      status: 400,
      title: 'One or more validation errors occurred.',
      errors,
    });
  }

  private json(route: Route, status: number, body: unknown) {
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  }
}
