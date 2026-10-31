import { Route } from '@playwright/test';

import type { MockAccount, MockProfile } from './mock-api';
import type { MockNotifications } from './mock-notifications';
import { holds, isShareable } from './role-definitions';

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
/** A 1×1 PNG standing in for every stored image, so no request leaves the browser. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
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
  /** Uploaded images by id, with the page they belong to (NoteImages). */
  readonly images = new Map<string, { pageId: string; content: Buffer; contentType: string }>();
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
    if (method === 'GET' && id === 'links') return this.suggestions(route, url, caller);
    if (method === 'GET' && id === 'members') return this.members(route, url);
    if (method === 'GET' && id === 'archived') return this.archived(route, caller);

    const note = this.find(id, caller);
    if (!note) return route.fulfill({ status: 404 });
    const admin = holds(caller, 'AdministerOrganisation');
    const canChange = note.ownerId === caller.profileId || admin;
    if (method === 'GET' && !match[2]) return this.json(route, 200, this.dto(note, caller));
    if (method === 'PUT' && !match[2]) {
      if (!canChange) return route.fulfill({ status: 403 });
      return this.save(route, note, caller, body);
    }
    if (method === 'POST' && (match[2] === 'archive' || match[2] === 'restore')) {
      if (!canChange) return route.fulfill({ status: 403 });
      const archive = match[2] === 'archive';
      if (!!note.archivedAt === archive)
        return this.json(route, 409, {
          status: 409,
          detail: archive ? 'It’s already archived.' : 'It isn’t archived.',
        });
      note.archivedAt = archive ? this.context.now.toISOString() : null;
      return route.fulfill({ status: 204 });
    }
    if (note.archivedAt && method === 'PUT')
      return this.invalid(route, { Version: ['Restore this page before you change it.'] });
    if (method === 'PUT' && match[2] === 'visibility') {
      if (!canChange) return route.fulfill({ status: 403 });
      return this.share(route, note, caller, body);
    }
    if (method === 'GET' && match[2] === 'images' && match[3]) {
      const image = this.images.get(match[3]);
      if (!image || image.pageId !== note.id) return route.fulfill({ status: 404 });
      return route.fulfill({ status: 200, body: image.content, contentType: image.contentType });
    }
    if (method === 'POST' && match[2] === 'images') {
      if (!canChange) return route.fulfill({ status: 403 });
      return this.upload(route, note);
    }
    if (method === 'GET' && match[2] === 'parent-options')
      return this.json(route, 200, this.parentOptions(note, url));
    if (method === 'PUT' && match[2] === 'parent') {
      if (!canChange) return route.fulfill({ status: 403 });
      return this.move(route, note, caller, body);
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
      holds(caller, 'AdministerOrganisation') ||
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
      return n.ownerId === caller.profileId || holds(caller, 'AdministerOrganisation')
        ? n
        : undefined;
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

  /** The search group (L2-096): what the caller may open, never archived. */
  searchItems(words: string[], caller: MockAccount) {
    return this.visible(caller)
      .filter((n) => words.every((w) => this.text(n).includes(w)))
      .map((n) => {
        const body = this.text(n).slice(n.title.length + 1);
        const at = body.indexOf(words[0]);
        const inTitle = n.title.toLowerCase().includes(words[0]);
        const plain = n.blocks
          .map((b) =>
            (b.text ?? [])
              .filter((t) => !t.pageId)
              .map((t) => t.text)
              .join(''),
          )
          .join(' ');
        return {
          id: n.id,
          title: `${n.icon ? n.icon + ' ' : ''}${n.title || 'Untitled'}`,
          snippet: [
            n.ownerId === caller.profileId ? 'you' : this.name(n.ownerId),
            `edited ${n.updatedAt.slice(0, 10)}`,
            !inTitle && at >= 0 ? plain.slice(Math.max(0, at - 40), at + 80) : null,
          ]
            .filter(Boolean)
            .join(' · '),
          route: `/notes/${n.id}`,
          startsAt: null,
          badge:
            n.visibility === 'Private'
              ? 'Private'
              : n.visibility === 'Shared'
                ? n.ownerId === caller.profileId
                  ? 'Shared'
                  : 'Shared with you'
                : null,
        };
      });
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
    const parentId = (body['parentId'] as string | null) ?? null;
    if (parentId) {
      const parent = this.find(parentId, caller);
      if (!parent) return route.fulfill({ status: 404 });
      if (parent.ownerId !== caller.profileId || parent.archivedAt)
        return this.invalid(route, { ParentId: ['Choose another page.'] });
    }
    const note = this.add({ title, ownerId: caller.profileId, parentId });
    return this.json(route, 201, this.dto(note, caller));
  }

  /** "[[" suggestions (L2-090 AC1): up to 10 visible pages by title, most recently edited first. */
  private suggestions(route: Route, url: URL, caller: MockAccount) {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const exclude = url.searchParams.get('exclude');
    const found = this.visible(caller)
      .filter((n) => n.id !== exclude && n.title.toLowerCase().includes(q))
      .slice(0, 10)
      .map((n) => this.ref(n));
    return this.json(route, 200, found);
  }

  private parentOptions(n: MockNote, url: URL) {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const excluded = this.descendants(n.id).add(n.id);
    return this.pages
      .filter((p) => p.ownerId === n.ownerId && !p.archivedAt && !excluded.has(p.id))
      .filter((p) => p.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((p) => this.ref(p));
  }

  /** Move (L2-091 AC5): only under an active page of the same owner, never under itself or below. */
  private move(route: Route, n: MockNote, caller: MockAccount, body: Record<string, unknown>) {
    const parentId = (body['parentId'] as string | null) ?? null;
    if (parentId) {
      const parent = this.find(parentId, caller);
      if (!parent) return route.fulfill({ status: 404 });
      if (
        parent.ownerId !== n.ownerId ||
        parent.archivedAt ||
        parent.id === n.id ||
        this.descendants(n.id).has(parent.id)
      )
        return this.invalid(route, { ParentId: ['Choose another page.'] });
    }
    n.parentId = parentId;
    return this.json(route, 200, this.dto(n, caller));
  }

  private archived(route: Route, caller: MockAccount) {
    const rows = this.pages
      .filter((n) => n.ownerId === caller.profileId && n.archivedAt)
      .sort((a, b) => b.archivedAt!.localeCompare(a.archivedAt!))
      .map((n) => ({
        id: n.id,
        title: n.title || 'Untitled',
        icon: n.icon,
        archivedAt: n.archivedAt,
      }));
    return this.json(route, 200, rows);
  }

  /** An image already uploaded to a page; returns its id. */
  addImage(n: MockNote): string {
    const id = `image-${this.images.size + 1}`;
    this.images.set(id, { pageId: n.id, content: PNG, contentType: 'image/png' });
    return id;
  }

  /** Image upload (L2-097 AC3, AC4): JPEG, PNG or WebP up to 5 MB, checked by its leading bytes. */
  private upload(route: Route, n: MockNote) {
    const data = route.request().postDataBuffer() ?? Buffer.alloc(0);
    const name = /filename="([^"]*)"/.exec(data.toString('latin1'))?.[1] ?? '';
    const isImage =
      /\.(png|jpe?g|webp)$/i.test(name) &&
      (data.includes(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ||
        data.includes(Buffer.from([0xff, 0xd8, 0xff])) ||
        data.includes(Buffer.from('WEBP')));
    if (!isImage || data.length > 5 * 1024 * 1024 + 4096)
      return this.invalid(route, { File: ['Use a JPEG, PNG or WebP image up to 5 MB.'] });
    const id = this.addImage(n);
    return this.json(route, 201, { imageId: id });
  }

  /** Share (L2-093): the visibility and audience, and a notification for each new recipient. */
  private share(route: Route, n: MockNote, caller: MockAccount, body: Record<string, unknown>) {
    const visibility = body['visibility'] as MockNoteVisibility;
    if (!['Private', 'Shared', 'Global'].includes(visibility))
      return this.invalid(route, { Visibility: ['Choose who can see it.'] });
    const memberIds = visibility === 'Shared' ? ((body['memberIds'] as string[]) ?? []) : [];
    const roles = visibility === 'Shared' ? ((body['roles'] as string[]) ?? []) : [];
    if (roles.some((r) => !isShareable(r)))
      return this.invalid(route, { Roles: ['Choose roles from the list.'] });
    if (visibility === 'Shared' && memberIds.length === 0 && roles.length === 0)
      return this.invalid(route, {
        Visibility: ['Choose at least one person or role, or pick another visibility.'],
      });
    const reached = this.recipients(n);
    Object.assign(n, { visibility, memberIds, roles });
    const owner = this.name(n.ownerId);
    for (const recipient of this.recipients(n).filter((id) => !reached.includes(id))) {
      this.context.notifications.add({
        recipientId: recipient,
        kind: 'NotePageShared',
        title: `${owner} shared ${n.title || 'Untitled'} with you`,
        linkPath: `/notes/${n.id}`,
        actorId: caller.profileId,
        actorName: caller.name,
      });
    }
    return this.json(route, 200, this.dto(n, caller));
  }

  /** Named members and current holders of named roles, without the owner and suspended members. */
  private recipients(n: MockNote): string[] {
    if (n.visibility !== 'Shared') return [];
    return [...this.context.accounts.values()]
      .filter((a) => !a.suspended && a.profileId !== n.ownerId)
      .filter((a) => n.memberIds.includes(a.profileId) || a.roles.some((r) => n.roles.includes(r)))
      .map((a) => a.profileId);
  }

  private members(route: Route, url: URL) {
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const people = [...this.context.accounts.values()]
      .filter((a) => !a.suspended && a.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 10)
      .map((a) => ({
        id: a.profileId,
        name: a.name,
        city: this.context.profiles.get(a.profileId)?.homeCity ?? null,
        roles: [...a.roles].sort(),
      }));
    return this.json(route, 200, people);
  }

  private descendants(id: string): Set<string> {
    const found = new Set<string>();
    let frontier = [id];
    while (frontier.length) {
      frontier = this.pages
        .filter((p) => p.parentId && frontier.includes(p.parentId) && !found.has(p.id))
        .map((p) => p.id);
      frontier.forEach((f) => found.add(f));
    }
    return found;
  }

  /** A page by icon and title, or "Private page" with no id (ADR 0025). */
  private ref(n: MockNote | undefined, caller?: MockAccount) {
    if (!n || (caller && (n.archivedAt || !this.mayOpen(n, caller))))
      return { id: null, title: 'Private page', icon: null };
    return { id: n.id, title: n.title || 'Untitled', icon: n.icon };
  }

  /** The plain text of each block, for assertions. */
  texts(n: MockNote): string[] {
    return n.blocks.map((b) => (b.text ?? []).map((s) => s.text).join(''));
  }

  /** Someone else saves the page, as another tab or a System Admin would. */
  editElsewhere(n: MockNote, by: string, text: string): void {
    n.blocks = [{ id: n.blocks[0]?.id ?? 'b', type: 'paragraph', text: [{ text }] }];
    n.version += 1;
    n.updatedById = by;
    n.updatedAt = this.context.now.toISOString();
  }

  /** A whole-page save (L2-086 AC8), refused with 409 when based on an older version (L2-094). */
  private save(route: Route, n: MockNote, caller: MockAccount, body: Record<string, unknown>) {
    if (body['version'] !== n.version)
      return this.json(route, 409, {
        status: 409,
        detail: 'This page changed somewhere else.',
        currentVersion: n.version,
        updatedByName: this.name(n.updatedById),
        updatedByYou: n.updatedById === caller.profileId,
        updatedAt: n.updatedAt,
      });
    const blocks = (body['blocks'] as MockBlock[] | undefined) ?? [];
    const title = String(body['title'] ?? '').trim();
    if (blocks.length > 500)
      return this.invalid(route, {
        Blocks: ['A page holds up to 500 blocks. Start a new page inside this one.'],
      });
    if (title.length > MAX_TITLE)
      return this.invalid(route, { Title: ['Use 200 characters or fewer for the title.'] });
    const linked = new Set(n.blocks.flatMap((b) => (b.text ?? []).map((t) => t.pageId)));
    const newLinks = blocks
      .flatMap((b) => (b.text ?? []).map((t) => t.pageId))
      .filter((id): id is string => !!id && !linked.has(id));
    if (
      newLinks.some(
        (id) =>
          this.ref(
            this.pages.find((p) => p.id === id),
            caller,
          ).id === null,
      )
    )
      return this.invalid(route, { Blocks: ['Link to a page you can open.'] });
    const refused = blocks.findIndex((b) => this.problem(b));
    if (refused >= 0)
      return this.invalid(route, { [`Blocks[${refused}]`]: [this.problem(blocks[refused])!] });
    n.title = title;
    n.icon = (body['icon'] as string | null) ?? null;
    n.blocks = blocks.map((b) => this.stored(b));
    // Page links are stored without their text (ADR 0025).
    n.blocks.forEach((b) => b.text?.forEach((t) => t.pageId && (t.text = '')));
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
    if ((b.text ?? []).some((t) => t.href && !/^(https:\/\/[^\s/]+|mailto:\S+)/.test(t.href)))
      return 'Use a link that starts with https:// or mailto:';
    if (b.type === 'image' && !(b.alt ?? '').trim()) return 'Describe this image';
    if (b.type === 'image' && !this.images.has(b.imageId ?? ''))
      return 'Add the image to this page first.';
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
      parentTitle: n.parentId
        ? this.ref(
            this.pages.find((p) => p.id === n.parentId),
            caller,
          ).title
        : null,
    };
  }

  private dto(n: MockNote, caller: MockAccount) {
    const own = n.ownerId === caller.profileId;
    const admin = holds(caller, 'AdministerOrganisation');
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
      blocks: n.blocks.map((b) =>
        b.text
          ? {
              ...b,
              text: b.text.map((t) =>
                t.pageId
                  ? {
                      ...t,
                      text: this.ref(
                        this.pages.find((p) => p.id === t.pageId),
                        caller,
                      ).title,
                    }
                  : t,
              ),
            }
          : b,
      ),
      version: n.version,
      createdAt: n.createdAt,
      archivedAt: n.archivedAt,
      canEdit: own || admin,
      isAdminView: !own && admin,
      breadcrumb: this.ancestors(n).map((a) => this.ref(a, caller)),
      children: this.pages
        .filter((c) => c.parentId === n.id && !c.archivedAt && this.mayOpen(c, caller))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((c) => this.ref(c)),
      backlinks: this.visible(caller)
        .filter(
          (p) => p.id !== n.id && p.blocks.some((b) => b.text?.some((t) => t.pageId === n.id)),
        )
        .map((p) => this.ref(p)),
      links: [...new Set(n.blocks.flatMap((b) => (b.text ?? []).map((t) => t.pageId)))]
        .map((id) =>
          this.ref(
            this.pages.find((p) => p.id === id),
            caller,
          ),
        )
        .filter((r) => r.id !== null),
    };
  }

  private ancestors(n: MockNote): (MockNote | undefined)[] {
    const chain: (MockNote | undefined)[] = [];
    let parentId = n.parentId;
    while (parentId && chain.length < 50) {
      const parent = this.pages.find((p) => p.id === parentId);
      chain.unshift(parent);
      parentId = parent?.parentId ?? null;
    }
    return chain;
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
