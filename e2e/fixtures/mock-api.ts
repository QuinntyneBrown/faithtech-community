import { Page, Route } from '@playwright/test';

import { MockAgile } from './mock-agile';
import { MockAnnouncements } from './mock-announcements';
import { MockConnect } from './mock-connect';
import { MockContacts } from './mock-contacts';
import { MockPartners } from './mock-partners';
import { MockEvents } from './mock-events';
import { MockGoogle } from './mock-google';
import { MockNotification, MockNotifications } from './mock-notifications';
import { MockSearch } from './mock-search';

export interface MockAccount {
  name: string;
  email: string;
  password: string;
  verified: boolean;
  suspended: boolean;
  roles: string[];
  profileId: string;
}

export interface MockPhoto {
  id: string;
  /** Null while the photo is saved but its image is not yet in storage. */
  url: string | null;
  altText: string;
  isFeatured: boolean;
  uploadedAt: string;
  /** False while the image waits for storage; seeded photos are stored. */
  isStored?: boolean;
}

/** A profile as GET /api/profiles/{id} returns it, without the caller-specific canEdit. */
export interface MockProfile {
  id: string;
  name: string;
  homeCity: string | null;
  bio: string | null;
  roles: string[];
  photos: MockPhoto[];
}

/**
 * A tiny square SVG standing in for a stored photo, so no request leaves the browser. Give each
 * photo its own `id`: stored photos never share a URL, and the photo list keys its items by URL.
 */
export function photoUrl(colour = '#7c5cff', id = ''): string {
  const name = id ? ` id="${id}"` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"${name} width="8" height="8"><rect width="8" height="8" fill="${colour}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export interface MockInvite {
  id: string;
  token: string;
  email: string;
  preassignedRole: string | null;
  note: string | null;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export type { MockNotification } from './mock-notifications';

export interface MockAuditEntry {
  id: string;
  occurredAtUtc: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  before: string | null;
  after: string | null;
  ipAddress: string;
}

const CITY_LEAD_ROLES = [
  'EventLead',
  'CreateLead',
  'CommunicationsLead',
  'Volunteer',
  'ProductEngineer',
  'Attendee',
];
const LEAD_ROLES = ['CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead', 'SystemAdmin'];
const TEAM_LEAD_ROLES = ['CityLead', 'EventLead', 'CreateLead', 'CommunicationsLead'];
const TEAM_ROLES = [...TEAM_LEAD_ROLES, 'Volunteer'];
const DAY = 24 * 60 * 60 * 1000;
/** The API's CORS origins (WebApp:Origin and Marketing:Origin), with credentials allowed. */
const ALLOWED_ORIGINS = ['http://localhost:4200', 'http://localhost:4300'];

/** Answers as the API's CORS policy does for an allowed origin. */
function withCors(route: Route, origin: string): Route {
  const cors = {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE',
  };
  return new Proxy(route, {
    get(target, prop) {
      if (prop === 'fulfill') {
        return (options: Parameters<Route['fulfill']>[0] = {}) =>
          target.fulfill({ ...options, headers: { ...options.headers, ...cors } });
      }
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

type Handler = (route: Route, body: Record<string, unknown>) => Promise<void> | void;

/**
 * Plays the Community API and identity server in the browser, following the backend contracts
 * (backend/src/FaithTech.Community.Api/Endpoints). The app's real PKCE flow runs against it.
 */
export class MockApi {
  readonly accounts = new Map<string, MockAccount>();
  readonly profiles = new Map<string, MockProfile>();
  readonly invites: MockInvite[] = [];
  readonly audit: MockAuditEntry[] = [];
  /** "Now" for invite status, matching the mocks' 21 October 2026. */
  now = new Date(Date.UTC(2026, 9, 21, 12));
  /** The events fake (fixtures/mock-events.ts), sharing this fake's clock. */
  readonly events = new MockEvents(
    () => this.now,
    (id) => this.profiles.get(id),
  );
  /** In-app notifications (L2-027) for the bell, the notifications page and home's Recent activity. */
  readonly notifications = new MockNotifications(() => this.now);
  /** Announcements and the announcement email opt-out (L2-029, L2-030). */
  readonly announcements = new MockAnnouncements(this);
  readonly calls: {
    method: string;
    path: string;
    body: Record<string, unknown>;
  }[] = [];
  /** Requests the fake does not implement. The fixture fails the test if any arrive (AGENTS.md). */
  readonly unrecognised: string[] = [];
  /** The Agile workspaces API: add workspaces, items and sprints through it. */
  readonly agile = new MockAgile(this.profiles, this.unrecognised, () => this.signedIn);
  private readonly overrides = new Map<string, Handler>();
  private session: MockAccount | null = null;
  private signedIn: MockAccount | null = null;
  private failures = new Map<string, number>();
  private uploads = 0;
  /** Blob storage is unavailable: uploads are saved as storing, as PhotoStorageRetryHandler would leave them. */
  photoStorageDown = false;
  private readonly storing = new Map<MockPhoto, string>();
  /** The stored URL of an uploaded photo; the journey videos swap in the image that was chosen. */
  uploadedPhotoUrl: (file: string) => string = (file) =>
    photoUrl(undefined, `upload-${this.uploads}-${file}`);
  /** Private contacts (ADR 0014). */
  readonly contacts = new MockContacts(this);
  /** City Leads' connect links: My QR code and the connect page (ADR 0021). */
  readonly connect = new MockConnect(this);
  /** The shared partner pipeline (ADR 0014). */
  readonly partners = new MockPartners(this);
  /** Global search over the other fakes, with the server's permission rules (L2-026). */
  readonly search = new MockSearch(this);
  /** Google sign-in: Google itself and the API's Google endpoints (L2-078). */
  readonly google = new MockGoogle(this, (account) => (this.session = account));

  constructor(private readonly page: Page) {}

  addAccount(account: Partial<MockAccount> & { email: string }): MockAccount {
    const full: MockAccount = {
      name: 'Grace Okonkwo',
      password: 'a-long-enough-passphrase',
      verified: true,
      suspended: false,
      roles: [],
      profileId: `profile-${this.accounts.size + 1}`,
      ...account,
    };
    this.accounts.set(full.email.toLowerCase(), full);
    if (!this.profiles.has(full.profileId)) {
      this.addProfile({ id: full.profileId, name: full.name, roles: full.roles });
    }
    return full;
  }

  /** A member's profile; give `id` to match an account's profileId. */
  addProfile(profile: Partial<MockProfile> & { name: string }): MockProfile {
    const full: MockProfile = {
      id: `profile-${this.profiles.size + 100}`,
      homeCity: null,
      bio: null,
      roles: [],
      photos: [],
      ...profile,
    };
    this.profiles.set(full.id, full);
    return full;
  }

  /** An invite as the Invites table holds it; give `daysAgo` to age it. */
  addInvite(
    invite: Partial<MockInvite> & { email: string; invitedBy: string },
    daysAgo = 1,
  ): MockInvite {
    const created = new Date(this.now.getTime() - daysAgo * DAY);
    const full: MockInvite = {
      id: `invite-${this.invites.length + 1}`,
      token: `token-${this.invites.length + 1}`,
      preassignedRole: null,
      note: null,
      createdAt: created.toISOString(),
      expiresAt: new Date(created.getTime() + 14 * DAY).toISOString(),
      acceptedAt: null,
      revokedAt: null,
      ...invite,
    };
    this.invites.push(full);
    return full;
  }

  /** Stops the browser's clock at the fake's "now", for screens that print today's date or greet by time. */
  async freezeBrowserClock(): Promise<void> {
    await this.page.clock.setFixedTime(this.now);
  }

  /** A notification for `recipientId`, `minutesAgo` before the fake's "now". */
  addNotification(
    notification: Partial<MockNotification> & { recipientId: string; title: string },
    minutesAgo = 0,
  ): MockNotification {
    return this.notifications.add(
      { kind: 'InviteAccepted', linkPath: '/', ...notification },
      minutesAgo,
    );
  }

  addAuditEntry(entry: Partial<MockAuditEntry> & { action: string; summary: string }): void {
    this.audit.push({
      id: `audit-${this.audit.length + 1}`,
      occurredAtUtc: this.now.toISOString(),
      actorId: 'profile-1',
      actorName: 'Priya Shah',
      targetType: 'Profile',
      targetId: 'profile-2',
      before: null,
      after: null,
      ipAddress: '10.0.0.1',
      ...entry,
    });
  }

  /** Storage has recovered and the retry worker has stored every waiting photo. */
  storePendingPhotos(): void {
    for (const [photo, url] of this.storing) {
      photo.url = url;
      photo.isStored = true;
    }
    this.storing.clear();
  }

  /** The marketing page's brochure video cannot be fetched, as when the file is missing (L2-075 AC4). */
  async breakBrochureVideo(): Promise<void> {
    await this.page.route('**/brochure/brochure.webm', (route) => route.fulfill({ status: 404 }));
  }

  /** Replaces the default behaviour of one endpoint, e.g. on('POST', '/api/account/sign-up', ...). */
  on(method: string, path: string, handler: Handler): void {
    this.overrides.set(`${method} ${path}`, handler);
  }

  /** Signs in through the app's real sign-in page and PKCE flow, then waits on the landing page. */
  async signInAs(account: MockAccount, path = '/'): Promise<void> {
    await this.page.goto(`/sign-in?returnUrl=${encodeURIComponent(path)}`);
    await this.page.getByLabel('Email').fill(account.email);
    await this.page.getByLabel('Password', { exact: true }).fill(account.password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await this.page.waitForURL((url) => url.pathname === path);
  }

  callsTo(method: string, path: string) {
    return this.calls.filter((c) => c.method === method && c.path === path);
  }

  async install(): Promise<void> {
    await this.page.route(/\/(api|connect)\//, (route) => this.handle(route));
    await this.page.route('https://accounts.google.com/**', (route) => this.google.consent(route));
    await this.page.route(/\/hubs\/agile\/negotiate/, (route) => this.agile.negotiate(route));
    await this.page.routeWebSocket(/\/hubs\/agile/, (ws) => this.agile.hub(ws));
  }

  /** From inside an override: answer as the fake backend normally would. */
  fallback(route: Route): Promise<void> {
    return this.handle(route, false);
  }

  private async handle(route: Route, overridable = true): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    // The marketing page calls the API from its own origin, as the real CORS policy allows (L2-079 AC3).
    const origin = request.headers()['origin'];
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      route = withCors(route, origin);
      if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    }
    const contentType = request.headers()['content-type'] ?? '';
    const body = contentType.startsWith('multipart/form-data')
      ? parseMultipart(request.postDataBuffer())
      : parseBody(request.postData(), contentType);
    if (overridable) this.calls.push({ method, path: url.pathname, body });

    const override = overridable ? this.overrides.get(`${method} ${url.pathname}`) : undefined;
    if (override) return override(route, body);

    const authorization = request.headers()['authorization'];
    const connect = this.connect.handle(route, method, url, body, this.caller(authorization));
    if (connect) return connect;
    const contacts = this.contacts.handle(route, method, url, body, this.caller(authorization));
    if (contacts) return contacts;
    const partners = this.partners.handle(route, method, url, body, this.caller(authorization));
    if (partners) return partners;
    if (this.agile.handles(url.pathname)) {
      return this.agile.handle({
        route,
        method,
        path: url.pathname,
        url,
        body,
        caller: this.caller(authorization),
      });
    }
    const events = this.events.handle(route, method, url, body, this.caller(authorization));
    if (events) return events;
    const notifications = this.notifications.handle(route, method, url, this.caller(authorization));
    if (notifications) return notifications;
    const announcements = this.announcements.handle(
      route,
      method,
      url,
      body,
      this.caller(authorization),
    );
    if (announcements) return announcements;
    const search = this.search.handle(route, method, url, this.caller(authorization));
    if (search) return search;
    const profileRoute = /^\/api\/profiles\/([^/]+)$/.exec(url.pathname);
    if (method === 'GET' && profileRoute) {
      return this.getProfile(route, profileRoute[1], authorization);
    }
    if (method === 'PUT' && profileRoute) {
      return this.updateProfile(route, profileRoute[1], body, authorization);
    }
    const photos = /^\/api\/profiles\/([^/]+)\/photos(?:\/([^/]+))?(\/featured)?$/.exec(
      url.pathname,
    );
    if (photos) return this.photos(route, method, photos, body, authorization);

    const roleRoute = /^\/api\/profiles\/([^/]+)\/roles(?:\/([^/]+))?$/.exec(url.pathname);
    if (roleRoute)
      return this.roles(route, method, roleRoute[1], roleRoute[2], body, authorization);
    const suspension = /^\/api\/admin\/users\/([^/]+)\/suspension$/.exec(url.pathname);
    if (suspension) return this.suspension(route, method, suspension[1], body, authorization);
    const inviteAction = /^\/api\/invites\/([^/]+)\/(resend|revoke)$/.exec(url.pathname);
    if (method === 'POST' && inviteAction) {
      return this.inviteAction(route, inviteAction[1], inviteAction[2], authorization);
    }

    switch (`${method} ${url.pathname}`) {
      case 'GET /api/admin/users':
        return this.searchUsers(route, url, authorization);
      case 'GET /api/admin/audit':
        return this.auditLog(route, url, authorization);
      case 'GET /api/admin/audit/export':
        return this.auditExport(route, url, authorization);
      case 'GET /api/activity':
        return this.activity(route, authorization);
      case 'GET /api/team':
        return this.listTeam(route, url, authorization);
      case 'GET /api/people':
        return this.listPeople(route, url, authorization);
      case 'GET /api/invites':
        return this.listInvites(route, url, authorization);
      case 'POST /api/invites':
        return this.sendInvite(route, body, authorization);
      case 'POST /api/invites/lookup':
        return this.lookUpInvite(route, String(body['token'] ?? ''));
      case 'POST /api/invites/accept':
        return this.acceptInvite(route, body, authorization);
      case 'POST /api/account/sign-in':
        return this.signIn(route, body);
      case 'GET /api/account/google/start':
        return this.google.start(route, url);
      case 'GET /api/account/google/callback':
        return this.google.callback(route, url);
      case 'GET /connect/authorize':
        return this.authorize(route, url);
      case 'POST /connect/token':
        return this.token(route, body);
      case 'GET /api/me':
        return this.me(route, request.headers()['authorization']);
      case 'POST /api/account/sign-out':
        this.signedIn = null;
        return route.fulfill({ status: 204 });
      case 'POST /api/account/sign-up':
        if (nameError(body['name']))
          return validationProblem(route, 'Name', nameError(body['name']));
        return route.fulfill({ status: 202 });
      case 'POST /api/account/resend-verification':
      case 'POST /api/account/forgot-password':
        return route.fulfill({ status: 202 });
      case 'POST /api/account/verify-email':
        // ConfirmEmailHandler: the verify link carries user-{profileId} for accounts the fake created.
        this.verifyEmail(String(body['userId'] ?? ''));
        return route.fulfill({ status: 200, json: {} });
      case 'POST /api/account/reset-password':
        return route.fulfill({ status: 200, json: {} });
      default:
        this.unrecognised.push(`${method} ${url.pathname}`);
        return route.abort('failed');
    }
  }

  /** Marks the account verified and connects it to the leads whose connect link it used (L2-084). */
  private verifyEmail(userId: string): void {
    const profileId = userId.replace(/^user-/, '');
    const account = [...this.accounts.values()].find((a) => a.profileId === profileId);
    if (!account || account.verified) return;
    account.verified = true;
    this.connect.verified(profileId);
  }

  private signIn(route: Route, body: Record<string, unknown>) {
    const email = String(body['email'] ?? '').toLowerCase();
    const account = this.accounts.get(email);
    const failures = this.failures.get(email) ?? 0;
    if (account && failures >= 5) return problem(route, 'locked_out');
    if (!account || account.password !== body['password']) {
      this.failures.set(email, failures + 1);
      return problem(route, 'invalid_credentials');
    }
    if (account.suspended) return problem(route, 'suspended');
    this.session = account;
    return route.fulfill({
      status: 200,
      json: { emailVerified: account.verified },
    });
  }

  private authorize(route: Route, url: URL) {
    if (!this.session) {
      const returnUrl = url.pathname + url.search;
      return route.fulfill({
        status: 302,
        headers: {
          location: `/sign-in?returnUrl=${encodeURIComponent(returnUrl)}`,
        },
      });
    }
    this.signedIn = this.session;
    const redirect = new URL(url.searchParams.get('redirect_uri')!);
    redirect.searchParams.set('code', 'authorization-code');
    redirect.searchParams.set('state', url.searchParams.get('state')!);
    return route.fulfill({
      status: 302,
      headers: { location: redirect.toString() },
    });
  }

  private token(route: Route, body: Record<string, unknown>) {
    if (body['grant_type'] === 'authorization_code' && !body['code_verifier']) {
      return route.fulfill({ status: 400, json: { error: 'invalid_grant' } });
    }
    if (!this.signedIn) return route.fulfill({ status: 400, json: { error: 'invalid_grant' } });
    return route.fulfill({
      status: 200,
      json: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 900,
      },
    });
  }

  private me(route: Route, authorization: string | undefined) {
    const account = this.signedIn;
    if (!account || authorization !== 'Bearer access-token') {
      return route.fulfill({ status: 401 });
    }
    return route.fulfill({
      status: 200,
      json: {
        id: '00000000-0000-0000-0000-000000000001',
        profileId: account.profileId,
        name: account.name,
        email: account.email,
        emailVerified: account.verified,
        roles: account.roles,
      },
    });
  }

  /** The signed-in caller, or null when the bearer token is missing or stale (the API's 401). */
  private caller(authorization: string | undefined): MockAccount | null {
    return this.signedIn && authorization === 'Bearer access-token' ? this.signedIn : null;
  }

  /** ActivityEndpoints: the ten newest notifications addressed to the caller (L2-049 AC7). */
  private activity(route: Route, authorization: string | undefined) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    const recorded = this.events.notifications.map((n, i) => ({
      ...n,
      id: `event-notification-${i + 1}`,
      createdAt: this.now.toISOString(),
    }));
    const items = [...this.notifications.notifications, ...recorded]
      .filter((n) => n.recipientId === caller.profileId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10)
      .map((n) => ({
        id: n.id,
        kind: n.kind,
        text: n.title,
        linkPath: n.linkPath,
        occurredAt: n.createdAt,
      }));
    return route.fulfill({ status: 200, json: items });
  }

  /** ProfilesEndpoints: GET /api/profiles/me and /api/profiles/{id} (L2-005). */
  private getProfile(route: Route, id: string, authorization: string | undefined) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    const profile = this.profiles.get(id === 'me' ? caller.profileId : id);
    if (!profile) return route.fulfill({ status: 404 });
    return route.fulfill({ status: 200, json: this.profileDto(profile, caller) });
  }

  /** PUT /api/profiles/{id}: owner or System Admin, same rules as UpdateProfileValidator (L2-006). */
  private updateProfile(
    route: Route,
    id: string,
    body: Record<string, unknown>,
    authorization: string | undefined,
  ) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    if (id !== caller.profileId && !caller.roles.includes('SystemAdmin')) {
      return route.fulfill({ status: 403 });
    }
    const profile = this.profiles.get(id);
    if (!profile) return route.fulfill({ status: 404 });
    const name = String(body['name'] ?? '').trim();
    const bio = String(body['bio'] ?? '').trim();
    const errors: Record<string, string[]> = {};
    if (!name) errors['Name'] = ['Enter your name as you’d like people to see it.'];
    else if (name.length > 100) errors['Name'] = ['Use 100 characters or fewer for your name.'];
    if (bio.length > 400) errors['Bio'] = ['Use 400 characters or fewer for your bio.'];
    if (Object.keys(errors).length)
      return route.fulfill({ status: 400, json: { status: 400, errors } });
    const before = { Name: profile.name, HomeCity: profile.homeCity, Bio: profile.bio };
    profile.name = name;
    profile.homeCity = String(body['homeCity'] ?? '').trim() || null;
    profile.bio = bio || null;
    const after = { Name: profile.name, HomeCity: profile.homeCity, Bio: profile.bio };
    this.auditOverride(caller, profile, 'profile.updated', before, after);
    return route.fulfill({ status: 204 });
  }

  /** ProfileAccess: a System Admin's change to someone else's profile is audited (ADR 0004). */
  private auditOverride(
    caller: MockAccount,
    profile: MockProfile,
    action: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): void {
    if (profile.id === caller.profileId) return;
    this.addAuditEntry({
      actorId: caller.profileId,
      actorName: caller.name,
      action,
      targetType: 'Profile',
      targetId: profile.id,
      summary: `${caller.name} changed ${profile.name}’s profile`,
      before: before && JSON.stringify(before),
      after: after && JSON.stringify(after),
    });
  }

  /** ProfilesEndpoints photo routes: upload, describe, feature and delete (L2-007). */
  private photos(
    route: Route,
    method: string,
    [, profileId, photoId, featured]: RegExpExecArray,
    body: Record<string, unknown>,
    authorization: string | undefined,
  ) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    if (profileId !== caller.profileId && !caller.roles.includes('SystemAdmin')) {
      return route.fulfill({ status: 403 });
    }
    const profile = this.profiles.get(profileId);
    if (!profile) return route.fulfill({ status: 404 });
    const invalid = (field: string, message: string) =>
      route.fulfill({ status: 400, json: { status: 400, errors: { [field]: [message] } } });

    if (method === 'POST' && !photoId) {
      const altText = String(body['altText'] ?? '').trim();
      if (profile.photos.length >= 10) {
        return invalid(
          'File',
          'That’s 10 photos, the most a profile can have. Remove one to add another.',
        );
      }
      if (!altText) return invalid('AltText', 'Describe this photo.');
      const url = this.uploadedPhotoUrl(String(body['file'] ?? ''));
      const photo: MockPhoto = {
        id: `photo-${++this.uploads}`,
        url: this.photoStorageDown ? null : url,
        altText,
        isFeatured: profile.photos.length === 0,
        uploadedAt: new Date(Date.UTC(2026, 9, 21, 12, this.uploads)).toISOString(),
        isStored: !this.photoStorageDown,
      };
      if (this.photoStorageDown) this.storing.set(photo, url);
      profile.photos.push(photo);
      this.auditOverride(caller, profile, 'profile.photo.uploaded', null, { AltText: altText });
      return route.fulfill({ status: 201, json: photo });
    }

    const photo = profile.photos.find((p) => p.id === photoId);
    if (!photo) return route.fulfill({ status: 404 });
    if (method === 'PUT' && featured) {
      for (const p of profile.photos) p.isFeatured = p === photo;
      this.auditOverride(caller, profile, 'profile.photo.featured', null, { PhotoId: photo.id });
      return route.fulfill({ status: 204 });
    }
    if (method === 'PUT') {
      const altText = String(body['altText'] ?? '').trim();
      if (!altText) return invalid('AltText', 'Describe this photo.');
      const before = { AltText: photo.altText };
      photo.altText = altText;
      this.auditOverride(caller, profile, 'profile.photo.described', before, { AltText: altText });
      return route.fulfill({ status: 204 });
    }
    if (method === 'DELETE') {
      profile.photos = profile.photos.filter((p) => p !== photo);
      this.auditOverride(
        caller,
        profile,
        'profile.photo.deleted',
        { AltText: photo.altText },
        null,
      );
      if (photo.isFeatured && profile.photos.length) {
        const newest = [...profile.photos].sort((a, b) =>
          b.uploadedAt.localeCompare(a.uploadedAt),
        )[0];
        newest.isFeatured = true;
      }
      return route.fulfill({ status: 204 });
    }
    this.unrecognised.push(`${method} ${route.request().url()}`);
    return route.abort('failed');
  }

  /** RolesEndpoints: the L2-009 limits and the last System Admin guard. */
  private roles(
    route: Route,
    method: string,
    profileId: string,
    roleName: string | undefined,
    body: Record<string, unknown>,
    authorization: string | undefined,
  ) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    const role =
      method === 'POST' ? String(body['role'] ?? '') : decodeURIComponent(roleName ?? '');
    const admin = caller.roles.includes('SystemAdmin');
    if (!admin && !(caller.roles.includes('CityLead') && CITY_LEAD_ROLES.includes(role))) {
      return route.fulfill({ status: 403 });
    }
    const profile = this.profiles.get(profileId);
    if (!profile) return route.fulfill({ status: 404 });
    const adding = method === 'POST';
    if (profile.roles.includes(role) === adding)
      return conflict(route, 'They already hold that role.');
    if (!adding && role === 'SystemAdmin') {
      const admins = [...this.profiles.values()].filter((p) => p.roles.includes('SystemAdmin'));
      if (admins.length <= 1)
        return conflict(route, 'There must always be at least one System Admin.');
    }
    profile.roles = adding ? [...profile.roles, role] : profile.roles.filter((r) => r !== role);
    for (const account of this.accounts.values()) {
      if (account.profileId === profile.id) account.roles = profile.roles;
    }
    return route.fulfill({ status: 200, json: profile.roles });
  }

  /** AdminUsersEndpoints: GET /api/admin/users, System Admin only, 25 per page by name. */
  private searchUsers(route: Route, url: URL, authorization: string | undefined) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    if (!caller.roles.includes('SystemAdmin')) return route.fulfill({ status: 403 });
    const term = (url.searchParams.get('q') ?? '').toLowerCase();
    const page = Number(url.searchParams.get('page') ?? '1');
    const all = [...this.accounts.values()]
      .map((a) => ({
        id: a.profileId,
        name: this.profiles.get(a.profileId)?.name ?? a.name,
        email: a.email,
        roles: this.profiles.get(a.profileId)?.roles ?? a.roles,
        status: a.suspended ? 'Suspended' : a.verified ? 'Active' : 'Unverified',
      }))
      .filter((u) => !term || u.name.toLowerCase().includes(term) || u.email.includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
    const items = all.slice((page - 1) * 25, page * 25);
    return route.fulfill({
      status: 200,
      json: { items, page, pageSize: 25, totalCount: all.length },
    });
  }

  /** PeopleEndpoints: GET /api/people, City Lead, Staff or System Admin, 25 per page by name (L2-053). */
  private listPeople(route: Route, url: URL, authorization: string | undefined) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    if (!caller.roles.some((r) => ['CityLead', 'Staff', 'SystemAdmin'].includes(r))) {
      return route.fulfill({ status: 403 });
    }
    const term = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const page = Number(url.searchParams.get('page') ?? '1');
    const all = [...this.accounts.values()]
      .map((a) => ({ account: a, profile: this.profiles.get(a.profileId)! }))
      .filter(
        ({ account, profile }) =>
          !term ||
          profile.name.toLowerCase().includes(term) ||
          account.email.toLowerCase().includes(term),
      )
      .sort((a, b) => a.profile.name.localeCompare(b.profile.name))
      .map(({ profile }) => ({
        id: profile.id,
        name: profile.name,
        homeCity: profile.homeCity,
        photoUrl: profile.photos.find((photo) => photo.isFeatured)?.url ?? null,
        roles: profile.roles,
      }));
    const items = all.slice((page - 1) * 25, page * 25);
    return route.fulfill({
      status: 200,
      json: { items, page, pageSize: 25, totalCount: all.length },
    });
  }

  private suspension(
    route: Route,
    method: string,
    profileId: string,
    body: Record<string, unknown>,
    authorization: string | undefined,
  ) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    if (!caller.roles.includes('SystemAdmin')) return route.fulfill({ status: 403 });
    const account = [...this.accounts.values()].find((a) => a.profileId === profileId);
    if (!account) return route.fulfill({ status: 404 });
    if (method === 'POST') {
      const reason = String(body['reason'] ?? '').trim();
      if (!reason) {
        return route.fulfill({
          status: 400,
          json: { status: 400, errors: { Reason: ['Give a reason so other admins understand.'] } },
        });
      }
      if (account === caller) return conflict(route, 'You can’t suspend your own account.');
      account.suspended = true;
    } else {
      account.suspended = false;
    }
    return route.fulfill({ status: 204 });
  }

  private filteredAudit(url: URL): MockAuditEntry[] {
    const category = url.searchParams.get('category');
    const matches: Record<string, (action: string) => boolean> = {
      roles: (a) => a.startsWith('role.'),
      suspensions: (a) => a === 'user.suspended' || a === 'user.reinstated',
      contacts: (a) => a.startsWith('contact.'),
      deletions: (a) => a.endsWith('.deleted'),
    };
    return this.audit
      .filter((e) => !category || matches[category]?.(e.action))
      .sort((a, b) => b.occurredAtUtc.localeCompare(a.occurredAtUtc));
  }

  /** AuditLogEndpoints: GET /api/admin/audit, System Admin only, 50 per page. */
  private auditLog(route: Route, url: URL, authorization: string | undefined) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    if (!caller.roles.includes('SystemAdmin')) return route.fulfill({ status: 403 });
    const page = Number(url.searchParams.get('page') ?? '1');
    const all = this.filteredAudit(url);
    const items = all.slice((page - 1) * 50, page * 50);
    return route.fulfill({
      status: 200,
      json: { items, page, pageSize: 50, totalCount: all.length },
    });
  }

  private auditExport(route: Route, url: URL, authorization: string | undefined) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    if (!caller.roles.includes('SystemAdmin')) return route.fulfill({ status: 403 });
    const rows = this.filteredAudit(url).map((e) =>
      [
        e.occurredAtUtc,
        e.actorName,
        e.action,
        `"${e.summary}"`,
        e.targetType,
        e.targetId,
        e.ipAddress,
      ].join(','),
    );
    return route.fulfill({
      status: 200,
      headers: { 'content-disposition': 'attachment; filename=audit-log.csv' },
      contentType: 'text/csv',
      body: ['When (UTC),Who,Action,Summary,Target type,Target id,IP address', ...rows].join('\n'),
    });
  }

  private inviteStatus(invite: MockInvite): string {
    if (invite.revokedAt) return 'Revoked';
    if (invite.acceptedAt) return 'Accepted';
    return this.now.toISOString() >= invite.expiresAt ? 'Expired' : 'Pending';
  }

  private inviteDto(invite: MockInvite) {
    const { token: _token, note: _note, invitedBy, ...rest } = invite;
    return {
      ...rest,
      status: this.inviteStatus(invite),
      invitedByName: this.profiles.get(invitedBy)?.name ?? 'A former member',
    };
  }

  /** InvitesEndpoints: leads and System Admins see every invite, newest first. */
  /** TeamEndpoints: GET /api/team?role=&city=, derived from current roles (L2-019, ADR 0007). */
  private listTeam(route: Route, url: URL, authorization: string | undefined) {
    if (!this.caller(authorization)) return route.fulfill({ status: 401 });
    const role = url.searchParams.get('role')?.toLowerCase();
    if (role && role !== 'leads' && role !== 'volunteers') return route.fulfill({ status: 400 });
    const city = url.searchParams.get('city')?.trim().toLowerCase();
    const team = [...this.profiles.values()].filter((p) =>
      p.roles.some((r) => TEAM_ROLES.includes(r)),
    );
    const key = (p: MockProfile) => `${p.name.toLowerCase()}|${p.id}`;
    const matching = team
      .filter((p) =>
        role === 'leads'
          ? p.roles.some((r) => TEAM_LEAD_ROLES.includes(r))
          : role === 'volunteers'
            ? p.roles.includes('Volunteer')
            : true,
      )
      .filter((p) => !city || p.homeCity?.trim().toLowerCase() === city)
      .sort((a, b) => key(a).localeCompare(key(b)));
    // Pages as ListTeamHandler does (ADR 0015): by lower-cased name then id, 50 a page, at most 100.
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 50) || 50));
    const after = url.searchParams.get('after');
    const rest = after ? matching.filter((p) => key(p).localeCompare(after) > 0) : matching;
    const page = rest.slice(0, size);
    const members = page.map((p) => ({
      profileId: p.id,
      name: p.name,
      homeCity: p.homeCity,
      photoUrl: p.photos.find((photo) => photo.isFeatured)?.url ?? null,
      roles: p.roles,
    }));
    const cities = [
      ...new Set(team.map((p) => p.homeCity?.trim()).filter((c): c is string => !!c)),
    ].sort((a, b) => a.localeCompare(b));
    return route.fulfill({
      status: 200,
      json: {
        members,
        cities,
        next: rest.length > size ? key(page[page.length - 1]) : null,
        totalCount: matching.length,
      },
    });
  }

  /**
   * GET /api/invites?after&pageSize: newest first (ties by id), 50 a page and at most 100, with a
   * keyset `next` like ManageInvitesHandler, so invites sent meanwhile never shift later pages.
   */
  private listInvites(route: Route, url: URL, authorization: string | undefined) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    if (!caller.roles.some((r) => LEAD_ROLES.includes(r))) return route.fulfill({ status: 403 });
    const key = (i: MockInvite) => `${i.createdAt}_${i.id}`;
    const invites = [...this.invites].sort((a, b) => key(b).localeCompare(key(a)));
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 50) || 50));
    const after = url.searchParams.get('after');
    const rest = after ? invites.filter((i) => key(i).localeCompare(after) < 0) : invites;
    const items = rest.slice(0, size);
    return route.fulfill({
      status: 200,
      json: {
        items: items.map((i) => this.inviteDto(i)),
        next: rest.length > size ? key(items[items.length - 1]) : null,
        totalCount: invites.length,
      },
    });
  }

  /** POST /api/invites: role limits, verified sender and 50 per 24 hours (L2-010). */
  private sendInvite(
    route: Route,
    body: Record<string, unknown>,
    authorization: string | undefined,
  ) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    if (!caller.roles.some((r) => LEAD_ROLES.includes(r))) return route.fulfill({ status: 403 });
    const email = String(body['email'] ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return route.fulfill({
        status: 400,
        json: { status: 400, errors: { Email: ['Enter an email like name@example.org.'] } },
      });
    }
    const role = (body['preassignedRole'] as string | null) ?? null;
    if (!caller.verified) {
      return problemDetail(route, 403, 'Verify your email before sending invites.');
    }
    const admin = caller.roles.includes('SystemAdmin');
    if (role && !admin && !(caller.roles.includes('CityLead') && CITY_LEAD_ROLES.includes(role))) {
      return problemDetail(route, 403, 'You can’t give that role.');
    }
    const since = new Date(this.now.getTime() - DAY).toISOString();
    const recent = this.invites.filter(
      (i) => i.invitedBy === caller.profileId && i.createdAt > since,
    );
    if (recent.length >= 50) {
      return problemDetail(
        route,
        429,
        'You’ve sent 50 invites in the last 24 hours. Try again tomorrow.',
      );
    }
    const invite = this.addInvite(
      {
        email,
        invitedBy: caller.profileId,
        preassignedRole: role,
        note: (body['note'] as string) ?? null,
      },
      0,
    );
    return route.fulfill({ status: 201, json: this.inviteDto(invite) });
  }

  private inviteAction(
    route: Route,
    id: string,
    action: string,
    authorization: string | undefined,
  ) {
    const caller = this.caller(authorization);
    if (!caller) return route.fulfill({ status: 401 });
    if (!caller.roles.some((r) => LEAD_ROLES.includes(r))) return route.fulfill({ status: 403 });
    const invite = this.invites.find((i) => i.id === id);
    if (!invite) return route.fulfill({ status: 404 });
    const status = this.inviteStatus(invite);
    if (action === 'revoke') {
      if (status !== 'Pending') return conflict(route, 'Only a pending invite can be withdrawn.');
      invite.revokedAt = this.now.toISOString();
      return route.fulfill({ status: 204 });
    }
    if (status !== 'Expired') return conflict(route, 'Only an expired invite can be resent.');
    const renewed = this.addInvite(
      { email: invite.email, invitedBy: caller.profileId, preassignedRole: invite.preassignedRole },
      0,
    );
    return route.fulfill({ status: 201, json: this.inviteDto(renewed) });
  }

  /** POST /api/invites/lookup with { token }: anonymous (ADR 0006); the token never goes in the URL. */
  private lookUpInvite(route: Route, token: string) {
    const invite = this.invites.find((i) => i.token === token);
    if (!invite) return route.fulfill({ status: 404 });
    const inviter = this.profiles.get(invite.invitedBy);
    return route.fulfill({
      status: 200,
      json: {
        status: this.inviteStatus(invite),
        email: invite.email,
        inviterName: inviter?.name ?? 'A FaithTech lead',
        inviterCity: inviter?.homeCity ?? null,
        preassignedRole: invite.preassignedRole,
        hasAccount: this.accounts.has(invite.email.toLowerCase()),
      },
    });
  }

  /** POST /api/invites/accept: a new verified account, or the signed-in account with the invited email. */
  private acceptInvite(
    route: Route,
    body: Record<string, unknown>,
    authorization: string | undefined,
  ) {
    const invite = this.invites.find((i) => i.token === body['token']);
    if (!invite) return route.fulfill({ status: 404 });
    const status = this.inviteStatus(invite);
    if (status !== 'Pending') {
      const detail = {
        Expired: 'This invite has expired.',
        Revoked: 'This invite was withdrawn.',
        Accepted: 'This invite has already been used.',
      }[status];
      return conflict(route, detail!);
    }
    let account: MockAccount;
    if (body['name'] !== null && body['name'] !== undefined) {
      if (nameError(body['name'])) return validationProblem(route, 'Name', nameError(body['name']));
      const password = String(body['password'] ?? '');
      if (password.length < 12) {
        return route.fulfill({
          status: 400,
          json: { status: 400, errors: { Password: ['Use at least 12 characters.'] } },
        });
      }
      if (this.accounts.has(invite.email.toLowerCase())) {
        return conflict(route, 'An account already uses this email. Sign in to accept the invite.');
      }
      account = this.addAccount({
        email: invite.email,
        name: String(body['name']),
        password,
        verified: true,
      });
    } else {
      const caller = this.caller(authorization);
      if (!caller)
        return route.fulfill({
          status: 400,
          json: { status: 400, errors: { Name: ['Enter your name.'] } },
        });
      if (caller.email.toLowerCase() !== invite.email.toLowerCase()) {
        return conflict(route, 'This invite is for another email.');
      }
      account = caller;
    }
    const profile = this.profiles.get(account.profileId)!;
    if (invite.preassignedRole && !profile.roles.includes(invite.preassignedRole)) {
      profile.roles = [...profile.roles, invite.preassignedRole];
      account.roles = profile.roles;
    }
    invite.acceptedAt = this.now.toISOString();
    return route.fulfill({ status: 204 });
  }

  private profileDto(profile: MockProfile, caller: MockAccount) {
    const photos = [...profile.photos]
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      .map((p) => ({ ...p, isStored: p.isStored ?? true }));
    return {
      ...profile,
      photos,
      featuredPhoto: photos.find((p) => p.isFeatured) ?? null,
      isOwn: profile.id === caller.profileId,
      canEdit: profile.id === caller.profileId || caller.roles.includes('SystemAdmin'),
    };
  }
}

/** The name rule shared by sign-up, invite sign-up and the profile editor. */
function nameError(value: unknown): string {
  const name = String(value ?? '').trim();
  if (!name) return 'Enter your name.';
  return name.length > 100 ? 'Use 100 characters or fewer for your name.' : '';
}

function validationProblem(route: Route, field: string, message: string) {
  return route.fulfill({ status: 400, json: { status: 400, errors: { [field]: [message] } } });
}

/** ResultMapper's 409 problem with a detail for the person. */
function conflict(route: Route, detail: string) {
  return problemDetail(route, 409, detail);
}

function problemDetail(route: Route, status: number, detail: string) {
  return route.fulfill({ status, json: { status, detail } });
}

/** Matches the problem body AccountEndpoints.SignInAsync returns. */
function problem(route: Route, code: string) {
  return route.fulfill({ status: 400, json: { status: 400, code } });
}

/** The text fields and the file name of a multipart/form-data body. */
function parseMultipart(data: Buffer | null): Record<string, unknown> {
  if (!data) return {};
  const text = data.toString('latin1');
  const fields: Record<string, unknown> = {};
  for (const part of text.split(/--[^\r\n]+\r\n/)) {
    const name = /name="([^"]+)"/.exec(part)?.[1];
    if (!name) continue;
    const fileName = /filename="([^"]*)"/.exec(part)?.[1];
    const value = part.slice(part.indexOf('\r\n\r\n') + 4).replace(/\r\n(--[^\r\n]*--)?\s*$/, '');
    fields[name] = fileName ?? Buffer.from(value, 'latin1').toString('utf8');
  }
  return fields;
}

function parseBody(data: string | null, contentType = ''): Record<string, unknown> {
  if (!data) return {};
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(data));
  }
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return {};
  }
}
