import { Route } from '@playwright/test';

import { MockCaller } from './mock-contacts';
import { MockEvent } from './mock-events';

/** A row of the Notifications table: addressed to one member (backend Domain/Notifications). */
export interface MockNotification {
  id: string;
  recipientId: string;
  kind: string;
  title: string;
  linkPath: string;
  createdAt: string;
  actorName?: string | null;
  readAt?: string | null;
}

/** An announcement as the Announcements table holds it, with its recipient snapshot. */
export interface MockAnnouncement {
  id: string;
  subject: string;
  body: string;
  sentAt: string;
  senderId: string;
  audience: { kind: 'Everyone' | 'Roles' | 'EventRsvps'; roles: string[]; eventId?: string | null };
  recipientIds: string[];
  alsoEmail: boolean;
}

/** What MockApi shares with this fake: the clock, the members and the other tables it reads. */
export interface NotificationsContext {
  now(): Date;
  profiles: Map<string, { id: string; name: string; roles: string[] }>;
  /** Suspended members get no announcements (ADR 0016). */
  isSuspended(profileId: string): boolean;
  /** Notifications other fakes recorded, such as the events fake's RSVP confirmations. */
  recorded(): MockNotification[];
  findEvent(id: string): MockEvent | undefined;
}

const PAGE_SIZE = 50;
const ANNOUNCEMENT_PAGE_SIZE = 20;
const SENDERS = ['CommunicationsLead', 'SystemAdmin'];
const ROLES = [
  'SystemAdmin',
  'Staff',
  'CityLead',
  'EventLead',
  'CreateLead',
  'CommunicationsLead',
  'Volunteer',
  'ProductEngineer',
  'Attendee',
];
const AUDIENCES = ['Everyone', 'Roles', 'EventRsvps'];

/**
 * NotificationsEndpoints and AnnouncementsEndpoints in the browser
 * (backend/src/FaithTech.Community.Api/Endpoints): each member sees only their own notifications and
 * the announcements sent to them; only Communications Leads and System Admins send (L2-027, L2-029,
 * L2-030). The unsubscribe token is `unsubscribe-<profileId>`; any other token is a bad link.
 */
export class MockNotifications {
  readonly notifications: MockNotification[] = [];
  readonly announcements: MockAnnouncement[] = [];
  /** Members who turned announcement emails off (Profile.AnnouncementEmailsOptedOut). */
  readonly optedOut = new Set<string>();
  private readonly readAt = new Map<string, string>();

  constructor(private readonly context: NotificationsContext) {}

  /** A notification for `recipientId`, `minutesAgo` before the fake's "now". */
  add(
    notification: Partial<MockNotification> & { recipientId: string; title: string },
    minutesAgo = 0,
  ): MockNotification {
    const full: MockNotification = {
      id: `notification-${this.notifications.length + 1}`,
      kind: 'InviteAccepted',
      linkPath: '/',
      createdAt: new Date(this.context.now().getTime() - minutesAgo * 60 * 1000).toISOString(),
      actorName: null,
      readAt: null,
      ...notification,
    };
    this.notifications.push(full);
    return full;
  }

  /** An announcement already sent, `minutesAgo` before "now". */
  addAnnouncement(
    announcement: Partial<MockAnnouncement> & { subject: string; senderId: string },
    minutesAgo = 0,
  ): MockAnnouncement {
    const full: MockAnnouncement = {
      id: `announcement-${this.announcements.length + 1}`,
      body: `${announcement.subject}.`,
      sentAt: new Date(this.context.now().getTime() - minutesAgo * 60 * 1000).toISOString(),
      audience: { kind: 'Everyone', roles: [] },
      recipientIds: [...this.context.profiles.keys()],
      alsoEmail: true,
      ...announcement,
    };
    this.announcements.push(full);
    return full;
  }

  /** Every notification with its read time, newest first; other fakes' notices count too. */
  all(): MockNotification[] {
    const recorded = this.context.recorded();
    return [...this.notifications, ...recorded]
      .map((n) => ({ ...n, readAt: n.readAt ?? this.readAt.get(n.id) ?? null }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockCaller | null,
  ): Promise<void> | undefined {
    const path = url.pathname;
    if (path === '/api/announcements/unsubscribe' && method === 'POST') {
      return this.unsubscribe(route, String(body['token'] ?? ''));
    }
    if (!path.startsWith('/api/notifications') && !path.startsWith('/api/announcements')) {
      if (path !== '/api/me/announcement-email-opt-out') return undefined;
    }
    if (!caller) return route.fulfill({ status: 401 });

    const read = /^\/api\/notifications\/([^/]+)\/read$/.exec(path);
    if (method === 'POST' && read && read[1] !== 'read-all')
      return this.markRead(route, read[1], caller);

    switch (`${method} ${path}`) {
      case 'GET /api/notifications':
        return this.list(route, url, caller);
      case 'GET /api/notifications/unread-count':
        return route.fulfill({ status: 200, json: { count: this.unread(caller).length } });
      case 'POST /api/notifications/read-all':
        for (const n of this.unread(caller))
          this.readAt.set(n.id, this.context.now().toISOString());
        return route.fulfill({ status: 204 });
      case 'GET /api/announcements':
        return this.listAnnouncements(route, url, caller);
      case 'POST /api/announcements/recipient-count':
        return this.count(route, body, caller);
      case 'POST /api/announcements':
        return this.send(route, body, caller);
      case 'GET /api/me/announcement-email-opt-out':
        return route.fulfill({
          status: 200,
          json: { optedOut: this.optedOut.has(caller.profileId) },
        });
      case 'PUT /api/me/announcement-email-opt-out':
        if (body['optedOut'] === true) this.optedOut.add(caller.profileId);
        else this.optedOut.delete(caller.profileId);
        return route.fulfill({ status: 204 });
      default:
        return undefined;
    }
  }

  private mine(caller: MockCaller): MockNotification[] {
    return this.all().filter((n) => n.recipientId === caller.profileId);
  }

  private unread(caller: MockCaller): MockNotification[] {
    return this.mine(caller).filter((n) => !n.readAt);
  }

  private list(route: Route, url: URL, caller: MockCaller) {
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const listed = unreadOnly ? this.unread(caller) : this.mine(caller);
    const items = listed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      linkPath: n.linkPath,
      actorName: n.actorName ?? null,
      createdAt: n.createdAt,
      readAt: n.readAt ?? null,
    }));
    return route.fulfill({
      status: 200,
      json: {
        items,
        unreadCount: this.unread(caller).length,
        page,
        pageSize: PAGE_SIZE,
        totalCount: listed.length,
      },
    });
  }

  /** Another member's notification is not found, so ids do not leak. */
  private markRead(route: Route, id: string, caller: MockCaller) {
    const notification = this.mine(caller).find((n) => n.id === id);
    if (!notification) return route.fulfill({ status: 404 });
    if (!this.readAt.has(id)) this.readAt.set(id, this.context.now().toISOString());
    return route.fulfill({ status: 204 });
  }

  private listAnnouncements(route: Route, url: URL, caller: MockCaller) {
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
    const mine = this.announcements
      .filter((a) => a.senderId === caller.profileId || a.recipientIds.includes(caller.profileId))
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    const items = mine
      .slice((page - 1) * ANNOUNCEMENT_PAGE_SIZE, page * ANNOUNCEMENT_PAGE_SIZE)
      .map((a) => ({
        id: a.id,
        subject: a.subject,
        body: a.body,
        sentAt: a.sentAt,
        senderName: this.context.profiles.get(a.senderId)?.name ?? 'FaithTech',
        audience: { kind: a.audience.kind, roles: [...a.audience.roles].sort() },
        recipientCount: a.recipientIds.length,
      }));
    return route.fulfill({
      status: 200,
      json: { items, page, pageSize: ANNOUNCEMENT_PAGE_SIZE, totalCount: mine.length },
    });
  }

  /** The audience's validation errors, as AudienceRequestValidator reports them. */
  private audienceErrors(audience: unknown): Record<string, string[]> | null {
    const a = (audience ?? null) as Record<string, unknown> | null;
    if (!a || !AUDIENCES.includes(String(a['kind'])))
      return { 'Audience.Kind': ['Choose who to send it to.'] };
    if (a['kind'] === 'Roles') {
      const roles = (a['roles'] as string[] | undefined) ?? [];
      if (roles.length === 0) return { 'Audience.Roles': ['Choose at least one role.'] };
      if (!roles.every((r) => ROLES.includes(r)))
        return { 'Audience.Roles': ['Choose roles from the list.'] };
    }
    if (a['kind'] === 'EventRsvps') {
      const event = this.context.findEvent(String(a['eventId'] ?? ''));
      if (!event) return { 'Audience.EventId': ['Choose an event.'] };
    }
    return null;
  }

  private recipients(audience: Record<string, unknown>): string[] {
    const members = [...this.context.profiles.values()].filter(
      (p) => !this.context.isSuspended(p.id),
    );
    if (audience['kind'] === 'Roles') {
      const roles = audience['roles'] as string[];
      return members.filter((p) => p.roles.some((r) => roles.includes(r))).map((p) => p.id);
    }
    if (audience['kind'] === 'EventRsvps') {
      const event = this.context.findEvent(String(audience['eventId']))!;
      const going = new Set(event.rsvps.map((r) => r.profileId).filter((id): id is string => !!id));
      return members.filter((p) => going.has(p.id)).map((p) => p.id);
    }
    return members.map((p) => p.id);
  }

  private count(route: Route, body: Record<string, unknown>, caller: MockCaller) {
    if (!caller.roles.some((r) => SENDERS.includes(r))) return route.fulfill({ status: 403 });
    const errors = this.audienceErrors(body);
    if (errors) return route.fulfill({ status: 400, json: { status: 400, errors } });
    return route.fulfill({ status: 200, json: { count: this.recipients(body).length } });
  }

  /** Permission first, then validation, as SendAnnouncementHandler does (L2-029 AC3). */
  private send(route: Route, body: Record<string, unknown>, caller: MockCaller) {
    if (!caller.roles.some((r) => SENDERS.includes(r))) return route.fulfill({ status: 403 });
    const subject = String(body['subject'] ?? '').trim();
    const text = String(body['body'] ?? '').trim();
    const errors: Record<string, string[]> = {};
    if (!subject) errors['Subject'] = ['Add a subject so people know what it’s about.'];
    else if (subject.length > 150)
      errors['Subject'] = ['Use 150 characters or fewer for the subject.'];
    if (!text) errors['Body'] = ['Write a message of at least one sentence.'];
    else if (text.length > 5000) errors['Body'] = ['Use 5000 characters or fewer for the message.'];
    Object.assign(errors, this.audienceErrors(body['audience']) ?? {});
    if (Object.keys(errors).length > 0)
      return route.fulfill({ status: 400, json: { status: 400, errors } });

    const audience = body['audience'] as Record<string, unknown>;
    const recipientIds = this.recipients(audience);
    const alsoEmail = body['alsoEmail'] !== false;
    const sent = this.addAnnouncement({
      subject,
      body: text,
      senderId: caller.profileId,
      audience: {
        kind: audience['kind'] as MockAnnouncement['audience']['kind'],
        roles: (audience['roles'] as string[] | undefined) ?? [],
        eventId: (audience['eventId'] as string | undefined) ?? null,
      },
      recipientIds,
      alsoEmail,
    });
    const sender = this.context.profiles.get(caller.profileId)?.name ?? 'FaithTech';
    for (const recipientId of recipientIds) {
      this.add({
        recipientId,
        kind: 'Announcement',
        title: `${sender} sent “${subject}”`,
        linkPath: '/announcements',
        actorName: sender,
      });
    }
    const emailCount = alsoEmail ? recipientIds.filter((id) => !this.optedOut.has(id)).length : 0;
    return route.fulfill({
      status: 201,
      json: { id: sent.id, recipientCount: recipientIds.length, emailCount },
    });
  }

  private unsubscribe(route: Route, token: string) {
    const profileId = /^unsubscribe-(.+)$/.exec(token)?.[1];
    if (!profileId || !this.context.profiles.has(profileId)) {
      return route.fulfill({
        status: 400,
        json: {
          status: 400,
          errors: {
            Token: [
              'This unsubscribe link doesn’t work. Sign in and turn off announcement emails in settings instead.',
            ],
          },
        },
      });
    }
    this.optedOut.add(profileId);
    return route.fulfill({ status: 204 });
  }
}
