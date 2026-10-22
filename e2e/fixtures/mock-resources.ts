import { Route } from '@playwright/test';

import type { MockAccount, MockProfile } from './mock-api';
import type { MockNotifications } from './mock-notifications';

export type MockResourceType =
  'Deck' | 'Logo' | 'Image' | 'Training' | 'Template' | 'Document' | 'Other';
export type MockVisibility = 'Private' | 'Shared' | 'Global';

/** A resource as the Resources table holds it, with its file bytes when it is an upload. */
export interface MockResource {
  id: string;
  title: string;
  description: string | null;
  type: MockResourceType;
  tags: string[];
  visibility: MockVisibility;
  memberIds: string[];
  roles: string[];
  ownerId: string;
  addedAt: string;
  fileName: string | null;
  size: number | null;
  content: Buffer | null;
  linkUrl: string | null;
  updatedAt: string | null;
  updatedById: string | null;
  fileReplacedAt: string | null;
  fileReplacedById: string | null;
  archivedAt: string | null;
}

/** What the resources fake reads from the rest of the fake backend. */
export interface ResourcesContext {
  readonly accounts: Map<string, MockAccount>;
  readonly profiles: Map<string, MockProfile>;
  readonly notifications: MockNotifications;
  readonly now: Date;
}

const CONTRIBUTORS = [
  'CityLead',
  'EventLead',
  'CreateLead',
  'CommunicationsLead',
  'Staff',
  'SystemAdmin',
];
const SHAREABLE = [
  'CityLead',
  'EventLead',
  'CreateLead',
  'CommunicationsLead',
  'Volunteer',
  'ProductEngineer',
  'Staff',
];
const TYPES: MockResourceType[] = [
  'Deck',
  'Logo',
  'Image',
  'Training',
  'Template',
  'Document',
  'Other',
];
const EXTENSIONS = [
  'pptx',
  'ppt',
  'key',
  'pdf',
  'docx',
  'doc',
  'xlsx',
  'csv',
  'png',
  'jpg',
  'svg',
  'gif',
  'webp',
  'mp4',
  'zip',
];
const MAX_BYTES = 100 * 1024 * 1024;
const PAGE_SIZE = 25;
const DAY = 24 * 60 * 60 * 1000;
const TITLE_MESSAGE = 'Give it a title so people can find it.';
const AUDIENCE_MESSAGE = 'Choose at least one person or role, or pick another visibility.';
const LINK_MESSAGE = 'Use a link that starts with https://.';

/** A tiny PNG standing in for every thumbnail, so no request leaves the browser. */
const THUMBNAIL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

interface Upload {
  fileName: string;
  content: Buffer;
}

interface Form {
  fields: Record<string, string[]>;
  files: Upload[];
}

function extensionOf(fileName: string): string {
  const ext = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext;
}

function guessType(fileName: string): MockResourceType {
  const ext = extensionOf(fileName);
  if (['pptx', 'ppt', 'key'].includes(ext)) return 'Deck';
  if (['png', 'jpg', 'gif', 'webp'].includes(ext)) return 'Image';
  if (ext === 'svg') return 'Logo';
  if (['pdf', 'docx', 'doc', 'xlsx', 'csv'].includes(ext)) return 'Document';
  return 'Other';
}

function refusal(fileName: string): string {
  return `${fileName} can’t be added. Use PPTX, PPT, KEY, PDF, DOCX, DOC, XLSX, CSV, PNG, JPG, SVG, GIF, WEBP, MP4 or ZIP, up to 100 MB. For longer video, add a link instead.`;
}

function hostOf(url: string): string {
  const host = new URL(url).host;
  return host.startsWith('www.') ? host.slice(4) : host;
}

/** Every part of a multipart/form-data body, keeping repeated fields and the file bytes. */
function parseForm(data: Buffer | null, contentType: string): Form {
  const form: Form = { fields: {}, files: [] };
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  if (!data || !boundary) return form;
  const marker = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  let start = data.indexOf(marker);
  while (start >= 0) {
    const next = data.indexOf(marker, start + marker.length);
    if (next < 0) break;
    const part = data.subarray(start + marker.length + 2, next - 2);
    const split = part.indexOf('\r\n\r\n');
    const head = part.subarray(0, split).toString('utf8');
    const body = part.subarray(split + 4);
    const name = /name="([^"]+)"/.exec(head)?.[1];
    const fileName = /filename="([^"]*)"/.exec(head)?.[1];
    if (name && fileName !== undefined) form.files.push({ fileName, content: Buffer.from(body) });
    else if (name) (form.fields[name] ??= []).push(body.toString('utf8'));
    start = next;
  }
  return form;
}

/**
 * ResourcesEndpoints in the browser (backend/src/FaithTech.Community.Api/Endpoints/ResourcesEndpoints.cs,
 * ADR 0017): visibility in every read (Private to the owner and System Admin, Shared to its members and the
 * current holders of its roles, Global to every member), owner-only writes, contributors only for adds.
 */
export class MockResources {
  readonly resources: MockResource[] = [];
  /** Uploads of these file names lose the connection once each, then succeed. */
  readonly dropOnce = new Set<string>();
  /** Uploads wait this long, so a test can see them in flight. */
  uploadDelayMs = 0;
  private counter = 0;

  constructor(private readonly context: ResourcesContext) {}

  /** A resource as the table holds it; give `daysAgo` to age it. */
  add(
    resource: Partial<MockResource> & { title: string; ownerId: string },
    daysAgo = 0,
  ): MockResource {
    const isLink = !!resource.linkUrl;
    const full: MockResource = {
      id: `resource-${++this.counter}`,
      description: null,
      type: 'Document',
      tags: [],
      visibility: 'Global',
      memberIds: [],
      roles: [],
      addedAt: new Date(this.context.now.getTime() - daysAgo * DAY).toISOString(),
      fileName: isLink ? null : `${resource.title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      size: isLink ? null : 3_100_000,
      content: isLink ? null : Buffer.from('%PDF-1.7 fake'),
      linkUrl: null,
      updatedAt: null,
      updatedById: null,
      fileReplacedAt: null,
      fileReplacedById: null,
      archivedAt: null,
      ...resource,
    };
    this.resources.push(full);
    return full;
  }

  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockAccount | null,
  ): Promise<void> | undefined {
    const match = /^\/api\/resources(?:\/([^/]+))?(?:\/([^/]+))?$/.exec(url.pathname);
    if (!match) return undefined;
    if (!caller) return route.fulfill({ status: 401 });
    const [, id, action] = match;
    const contributes = caller.roles.some((r) => CONTRIBUTORS.includes(r));
    const admin = caller.roles.includes('SystemAdmin');

    if (!id) {
      if (method === 'GET') return this.list(route, url, caller);
      if (method === 'POST') return this.upload(route, caller, contributes);
    }
    if (method === 'GET' && id === 'tags') return this.tags(route, url, caller);
    if (method === 'GET' && id === 'archived') return this.archived(route, caller);
    if (method === 'GET' && (id === 'members' || id === 'owner-candidates')) {
      const owners = id === 'owner-candidates';
      if (owners ? !admin : !contributes) return route.fulfill({ status: 403 });
      return this.members(route, url, owners);
    }
    if (method === 'POST' && id === 'links') return this.addLink(route, caller, contributes, body);

    const resource = this.find(id, caller);
    if (!resource) return route.fulfill({ status: 404 });
    const canChange = resource.ownerId === caller.profileId || admin;
    switch (`${method} ${action ?? ''}`) {
      case 'GET ':
        return this.json(route, 200, this.dto(resource, caller));
      case 'GET file':
        return route.fulfill({
          status: 200,
          body: resource.content ?? Buffer.alloc(0),
          headers: {
            'content-type': 'application/octet-stream',
            'content-disposition': `attachment; filename="${resource.fileName}"`,
          },
        });
      case 'GET thumbnail':
        return this.hasThumbnail(resource)
          ? route.fulfill({ status: 200, body: THUMBNAIL, contentType: 'image/png' })
          : route.fulfill({ status: 404 });
      case 'PUT ':
        if (!canChange) return route.fulfill({ status: 403 });
        return this.edit(route, resource, caller, body);
      case 'PUT file':
        if (!canChange) return route.fulfill({ status: 403 });
        return this.replace(route, resource, caller);
      case 'POST archive':
        if (!canChange) return route.fulfill({ status: 403 });
        if (resource.archivedAt)
          return this.json(route, 409, { status: 409, detail: 'It’s already archived.' });
        resource.archivedAt = this.context.now.toISOString();
        return route.fulfill({ status: 204 });
      case 'POST restore':
        if (!canChange) return route.fulfill({ status: 403 });
        if (!resource.archivedAt)
          return this.json(route, 409, { status: 409, detail: 'It isn’t archived.' });
        resource.archivedAt = null;
        return route.fulfill({ status: 204 });
      case 'PUT owner':
        if (!admin) return route.fulfill({ status: 403 });
        return this.transfer(route, resource, caller, body);
      default:
        return route.fulfill({ status: 405 });
    }
  }

  /** The search group (L2-065): what the caller may open, never archived. */
  searchItems(words: string[], caller: MockAccount) {
    return this.visible(caller)
      .filter((r) => {
        const text = [r.title, r.description, r.tags.join(' '), r.fileName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return words.every((w) => text.includes(w));
      })
      .map((r) => {
        const tag = r.tags.find((t) => words.some((w) => t.includes(w)));
        const why = words.some((w) => r.title.toLowerCase().includes(w))
          ? null
          : tag
            ? `tagged ${tag}`
            : null;
        return {
          id: r.id,
          title: r.title,
          snippet: [
            r.type,
            r.linkUrl ? hostOf(r.linkUrl) : extensionOf(r.fileName!).toUpperCase(),
            this.name(r.ownerId),
            why,
          ]
            .filter(Boolean)
            .join(' · '),
          route: `/resources/${r.id}`,
          startsAt: null,
          badge:
            r.visibility === 'Private'
              ? 'Private'
              : r.visibility === 'Shared'
                ? r.ownerId === caller.profileId
                  ? 'Shared'
                  : 'Shared with you'
                : null,
        };
      });
  }

  private visible(caller: MockAccount): MockResource[] {
    return this.resources
      .filter((r) => !r.archivedAt && this.mayOpen(r, caller))
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }

  private mayOpen(r: MockResource, caller: MockAccount): boolean {
    return (
      r.visibility === 'Global' ||
      r.ownerId === caller.profileId ||
      caller.roles.includes('SystemAdmin') ||
      (r.visibility === 'Shared' &&
        (r.memberIds.includes(caller.profileId) ||
          r.roles.some((role) => caller.roles.includes(role))))
    );
  }

  private find(id: string, caller: MockAccount): MockResource | undefined {
    const r = this.resources.find((x) => x.id === id);
    if (!r) return undefined;
    if (r.archivedAt)
      return r.ownerId === caller.profileId || caller.roles.includes('SystemAdmin') ? r : undefined;
    return this.mayOpen(r, caller) ? r : undefined;
  }

  private list(route: Route, url: URL, caller: MockAccount) {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const type = url.searchParams.get('type');
    const tag = url.searchParams.get('tag');
    const page = Number(url.searchParams.get('page') ?? '1');
    const words = q.split(/\s+/).filter(Boolean);
    const rows = this.visible(caller)
      .filter((r) => !type || r.type === type)
      .filter((r) => !tag || r.tags.includes(tag))
      .filter((r) => {
        const text = [r.title, r.description, r.tags.join(' '), r.fileName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return words.every((w) => text.includes(w));
      });
    const items = rows
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((r) => this.summary(r, caller));
    return this.json(route, 200, { items, page, pageSize: PAGE_SIZE, totalCount: rows.length });
  }

  private tags(route: Route, url: URL, caller: MockAccount) {
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const counts = new Map<string, number>();
    for (const r of this.visible(caller))
      for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    const tags = [...counts]
      .filter(([name]) => name.includes(q))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
    return this.json(route, 200, tags);
  }

  private archived(route: Route, caller: MockAccount) {
    const rows = this.resources
      .filter((r) => r.ownerId === caller.profileId && r.archivedAt)
      .sort((a, b) => b.archivedAt!.localeCompare(a.archivedAt!))
      .map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        extension: r.fileName ? extensionOf(r.fileName) : null,
        size: r.size,
        linkHost: r.linkUrl ? hostOf(r.linkUrl) : null,
        archivedAt: r.archivedAt,
        purgeAt: new Date(new Date(r.archivedAt!).getTime() + 30 * DAY).toISOString(),
      }));
    return this.json(route, 200, rows);
  }

  private members(route: Route, url: URL, owners: boolean) {
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const people = [...this.context.accounts.values()]
      .filter((a) => !a.suspended && a.name.toLowerCase().includes(q))
      .filter((a) => !owners || a.roles.some((r) => CONTRIBUTORS.includes(r)))
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

  private upload(route: Route, caller: MockAccount, contributes: boolean) {
    if (!contributes) return route.fulfill({ status: 403 });
    if (!caller.verified)
      return this.json(route, 403, {
        status: 403,
        detail: 'Verify your email before adding resources.',
      });
    const request = route.request();
    const form = parseForm(request.postDataBuffer(), request.headers()['content-type'] ?? '');
    if (form.files.length === 0)
      return this.invalid(route, { Files: ['Choose at least one file.'] });
    if (form.files.length > 20)
      return this.invalid(route, { Files: ['Add up to 20 files at a time.'] });
    const refused = form.files.filter(
      (f) =>
        !EXTENSIONS.includes(extensionOf(f.fileName)) ||
        f.content.length === 0 ||
        f.content.length > MAX_BYTES,
    );
    if (refused.length)
      return this.invalid(route, { Files: refused.map((f) => refusal(f.fileName)) });
    const one = (key: string) => form.fields[key]?.[0] ?? null;
    const errors = this.check(
      {
        title: one('title'),
        description: one('description'),
        type: one('type'),
        visibility: one('visibility'),
        memberIds: form.fields['memberIds'] ?? [],
        roles: form.fields['roles'] ?? [],
      },
      false,
    );
    if (errors) return this.invalid(route, errors);
    return this.delayed(async () => {
      const dropped = form.files.find((f) => this.dropOnce.delete(f.fileName));
      if (dropped) return route.abort('connectionreset');
      const single = form.files.length === 1;
      const added = form.files.map((file) =>
        this.add({
          title: (single && one('title')?.trim()) || file.fileName.replace(/\.[^.]+$/, ''),
          description: one('description')?.trim() || null,
          type: ((single && one('type')) || guessType(file.fileName)) as MockResourceType,
          tags: this.tagsOf(form.fields['tags']),
          ownerId: caller.profileId,
          fileName: file.fileName,
          size: file.content.length,
          content: file.content,
          ...this.audience(
            one('visibility'),
            form.fields['memberIds'] ?? [],
            form.fields['roles'] ?? [],
          ),
        }),
      );
      added.forEach((r) => this.notifyShared(r, caller, []));
      return this.json(
        route,
        201,
        added.map((r) => this.dto(r, caller)),
      );
    });
  }

  private addLink(
    route: Route,
    caller: MockAccount,
    contributes: boolean,
    body: Record<string, unknown>,
  ) {
    if (!contributes) return route.fulfill({ status: 403 });
    const errors = this.check(this.input(body), true) ?? {};
    const url = String(body['url'] ?? '').trim();
    if (!/^https:\/\/[^\s/]+\.[^\s]+/i.test(url)) errors['Url'] = [LINK_MESSAGE];
    if (Object.keys(errors).length) return this.invalid(route, errors);
    const input = this.input(body);
    const resource = this.add({
      title: input.title!.trim(),
      description: input.description?.trim() || null,
      type: input.type as MockResourceType,
      tags: this.tagsOf(body['tags'] as string[]),
      ownerId: caller.profileId,
      linkUrl: url,
      ...this.audience(input.visibility, input.memberIds, input.roles),
    });
    this.notifyShared(resource, caller, []);
    return this.json(route, 201, this.dto(resource, caller));
  }

  private edit(
    route: Route,
    resource: MockResource,
    caller: MockAccount,
    body: Record<string, unknown>,
  ) {
    if (resource.archivedAt)
      return this.json(route, 409, { status: 409, detail: 'Restore it before you edit it.' });
    const input = this.input(body);
    const errors = this.check(input, true) ?? {};
    const url = String(body['url'] ?? '').trim();
    if (resource.linkUrl && !/^https:\/\/[^\s/]+\.[^\s]+/i.test(url))
      errors['Url'] = [LINK_MESSAGE];
    if (Object.keys(errors).length) return this.invalid(route, errors);
    const reached = this.recipients(resource);
    Object.assign(resource, {
      title: input.title!.trim(),
      description: input.description?.trim() || null,
      type: input.type,
      tags: this.tagsOf(body['tags'] as string[]),
      linkUrl: resource.linkUrl ? url : null,
      updatedAt: this.context.now.toISOString(),
      updatedById: caller.profileId,
      ...this.audience(input.visibility, input.memberIds, input.roles),
    });
    this.notifyShared(resource, caller, reached);
    return this.json(route, 200, this.dto(resource, caller));
  }

  private replace(route: Route, resource: MockResource, caller: MockAccount) {
    const request = route.request();
    const form = parseForm(request.postDataBuffer(), request.headers()['content-type'] ?? '');
    const file = form.files[0];
    if (!file || form.files.length !== 1)
      return this.invalid(route, { Files: ['Choose one file to replace it with.'] });
    if (!EXTENSIONS.includes(extensionOf(file.fileName)) || file.content.length > MAX_BYTES)
      return this.invalid(route, { Files: [refusal(file.fileName)] });
    return this.delayed(async () => {
      Object.assign(resource, {
        fileName: file.fileName,
        size: file.content.length,
        content: file.content,
        fileReplacedAt: this.context.now.toISOString(),
        fileReplacedById: caller.profileId,
        updatedAt: this.context.now.toISOString(),
        updatedById: caller.profileId,
      });
      return this.json(route, 200, this.dto(resource, caller));
    });
  }

  private transfer(
    route: Route,
    resource: MockResource,
    caller: MockAccount,
    body: Record<string, unknown>,
  ) {
    const ownerId = body['ownerId'] as string | null;
    if (!ownerId) return this.invalid(route, { OwnerId: ['Choose who should own it.'] });
    const owner = [...this.context.accounts.values()].find((a) => a.profileId === ownerId);
    if (!owner || owner.suspended || !owner.roles.some((r) => CONTRIBUTORS.includes(r))) {
      return this.invalid(route, {
        OwnerId: ['Choose a lead, Staff member or System Admin; only they can own resources.'],
      });
    }
    resource.ownerId = ownerId;
    this.context.notifications.add({
      recipientId: ownerId,
      kind: 'ResourceOwnershipTransferred',
      title: `${caller.name} made you the owner of ${resource.title}`,
      linkPath: `/resources/${resource.id}`,
      actorId: caller.profileId,
      actorName: caller.name,
    });
    return this.json(route, 200, this.dto(resource, caller));
  }

  private input(body: Record<string, unknown>) {
    return {
      title: (body['title'] as string | null) ?? null,
      description: (body['description'] as string | null) ?? null,
      type: (body['type'] as string | null) ?? null,
      visibility: (body['visibility'] as string | null) ?? null,
      memberIds: (body['memberIds'] as string[] | undefined) ?? [],
      roles: (body['roles'] as string[] | undefined) ?? [],
    };
  }

  /** The L2-059 field rules; null when every field is fine. */
  private check(
    input: {
      title: string | null;
      description: string | null;
      type: string | null;
      visibility: string | null;
      memberIds: string[];
      roles: string[];
    },
    titleRequired: boolean,
  ): Record<string, string[]> | null {
    const errors: Record<string, string[]> = {};
    const title = input.title?.trim() ?? '';
    if (titleRequired && !title) errors['Title'] = [TITLE_MESSAGE];
    else if (title.length > 120) errors['Title'] = ['Use 120 characters or fewer for the title.'];
    if ((input.description?.trim().length ?? 0) > 1000)
      errors['Description'] = ['Use 1,000 characters or fewer for the description.'];
    if ((titleRequired || input.type) && !TYPES.includes(input.type as MockResourceType))
      errors['Type'] = ['Choose a type.'];
    const visibility = input.visibility || 'Global';
    if (!['Private', 'Shared', 'Global'].includes(visibility))
      errors['Visibility'] = ['Choose who can see it.'];
    if (visibility === 'Shared') {
      if (input.roles.some((r) => !SHAREABLE.includes(r)))
        errors['Roles'] = ['Choose roles from the list.'];
      else if (input.memberIds.length === 0 && input.roles.length === 0)
        errors['Visibility'] = [AUDIENCE_MESSAGE];
    }
    return Object.keys(errors).length ? errors : null;
  }

  private audience(visibility: string | null, memberIds: string[], roles: string[]) {
    const v = (visibility || 'Global') as MockVisibility;
    return v === 'Shared'
      ? { visibility: v, memberIds: [...new Set(memberIds)], roles: [...new Set(roles)] }
      : { visibility: v, memberIds: [], roles: [] };
  }

  private tagsOf(tags: string[] | undefined): string[] {
    return [...new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))];
  }

  /** Named members plus current holders of named roles, without the owner or suspended members. */
  private recipients(r: MockResource): string[] {
    if (r.visibility !== 'Shared') return [];
    return [...this.context.accounts.values()]
      .filter((a) => !a.suspended && a.profileId !== r.ownerId)
      .filter(
        (a) => r.memberIds.includes(a.profileId) || a.roles.some((role) => r.roles.includes(role)),
      )
      .map((a) => a.profileId);
  }

  private notifyShared(r: MockResource, caller: MockAccount, alreadyReached: string[]): void {
    const owner = this.name(r.ownerId);
    for (const recipient of this.recipients(r).filter((id) => !alreadyReached.includes(id))) {
      this.context.notifications.add({
        recipientId: recipient,
        kind: 'ResourceShared',
        title: `${owner} shared ${r.title} with you`,
        linkPath: `/resources/${r.id}`,
        actorId: caller.profileId,
        actorName: caller.name,
      });
    }
  }

  private hasThumbnail(r: MockResource): boolean {
    return !!r.fileName && ['png', 'jpg', 'gif', 'webp'].includes(extensionOf(r.fileName));
  }

  private name(profileId: string | null): string {
    return (profileId && this.context.profiles.get(profileId)?.name) || 'A former member';
  }

  private summary(r: MockResource, caller: MockAccount) {
    const isOwn = r.ownerId === caller.profileId;
    return {
      id: r.id,
      title: r.title,
      type: r.type,
      fileName: r.fileName,
      extension: r.fileName ? extensionOf(r.fileName) : null,
      size: r.size,
      linkUrl: r.linkUrl,
      linkHost: r.linkUrl ? hostOf(r.linkUrl) : null,
      ownerId: r.ownerId,
      ownerName: this.name(r.ownerId),
      isOwn,
      visibility: r.visibility,
      sharedWithYou:
        r.visibility === 'Shared' &&
        !isOwn &&
        (r.memberIds.includes(caller.profileId) ||
          r.roles.some((role) => caller.roles.includes(role))),
      hasThumbnail: this.hasThumbnail(r),
      isStored: true,
      addedAt: r.addedAt,
    };
  }

  private dto(r: MockResource, caller: MockAccount) {
    const summary = this.summary(r, caller);
    const admin = caller.roles.includes('SystemAdmin');
    const ownerAccount = [...this.context.accounts.values()].find((a) => a.profileId === r.ownerId);
    const sharedVia = summary.sharedWithYou
      ? r.memberIds.includes(caller.profileId)
        ? 'you'
        : r.roles.find((role) => caller.roles.includes(role))!
      : null;
    return {
      ...summary,
      description: r.description,
      tags: r.tags,
      sharedVia,
      audience: {
        members: r.memberIds.map((id) => ({
          id,
          name: this.name(id),
          city: this.context.profiles.get(id)?.homeCity ?? null,
        })),
        roles: r.roles.map((role) => ({
          role,
          count: [...this.context.accounts.values()].filter(
            (a) => !a.suspended && a.roles.includes(role),
          ).length,
        })),
      },
      updatedAt: r.updatedAt,
      updatedByName: r.updatedById ? this.name(r.updatedById) : null,
      fileReplacedAt: r.fileReplacedAt,
      fileReplacedByName: r.fileReplacedById ? this.name(r.fileReplacedById) : null,
      archivedAt: r.archivedAt,
      purgeAt: r.archivedAt
        ? new Date(new Date(r.archivedAt).getTime() + 30 * DAY).toISOString()
        : null,
      canEdit: summary.isOwn || admin,
      canTransfer: admin,
      ownerLostRole:
        ownerAccount && !ownerAccount.roles.some((role) => CONTRIBUTORS.includes(role))
          ? 'CityLead'
          : null,
    };
  }

  private async delayed(answer: () => Promise<void>): Promise<void> {
    if (this.uploadDelayMs) await new Promise((resolve) => setTimeout(resolve, this.uploadDelayMs));
    return answer();
  }

  private invalid(route: Route, errors: Record<string, string[]>) {
    return this.json(route, 400, { status: 400, errors });
  }

  private json(route: Route, status: number, json: unknown) {
    return route.fulfill({ status, json });
  }
}
