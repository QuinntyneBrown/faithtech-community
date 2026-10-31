import { Route } from '@playwright/test';

import type { MockAccount } from './mock-api';
import type { MockEvents } from './mock-events';
import type { MockNotifications } from './mock-notifications';
import { holds } from './role-definitions';

/** An announcement as the Announcements table holds it, with its recipients' profile ids. */
export interface MockAnnouncement {
  id: string;
  subject: string;
  body: string;
  audience: { kind: string; roles?: string[]; eventId?: string };
  senderId: string;
  sentAt: string;
  alsoEmail: boolean;
  recipientIds: string[];
}

/** What the announcements fake reads from the rest of the fake backend. */
export interface AnnouncementsContext {
  readonly accounts: Map<string, MockAccount>;
  readonly events: MockEvents;
  readonly notifications: MockNotifications;
  readonly now: Date;
}

/**
 * Plays the announcements endpoints (backend/src/FaithTech.Community.Api/Endpoints/AnnouncementsEndpoints.cs):
 * the audience resolves to members who are not suspended, and only Communications Leads and System Admins
 * may count or send (L2-029).
 */
export class MockAnnouncements {
  readonly announcements: MockAnnouncement[] = [];
  /** Profile ids of members who turned announcement emails off (L2-030). */
  readonly optedOut = new Set<string>();
  /** Unsubscribe tokens from announcement emails, and the profile each one names. */
  readonly tokens = new Map<string, string>();

  constructor(private readonly context: AnnouncementsContext) {}

  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockAccount | null,
  ): Promise<void> | undefined {
    const optOut = url.pathname === '/api/me/announcement-email-opt-out';
    if (!url.pathname.startsWith('/api/announcements') && !optOut) return undefined;
    if (method === 'POST' && url.pathname === '/api/announcements/unsubscribe') {
      // Anonymous: the token is the credential (L2-030 AC3).
      const profileId = this.tokens.get(String(body['token'] ?? ''));
      if (!profileId) {
        return route.fulfill({
          status: 400,
          json: { status: 400, errors: { Token: ['This unsubscribe link doesn’t work.'] } },
        });
      }
      this.optedOut.add(profileId);
      return route.fulfill({ status: 204 });
    }
    if (!caller) return route.fulfill({ status: 401 });
    if (optOut && method === 'GET') {
      return route.fulfill({
        status: 200,
        json: { optedOut: this.optedOut.has(caller.profileId) },
      });
    }
    if (optOut && method === 'PUT') {
      if (body['optedOut']) this.optedOut.add(caller.profileId);
      else this.optedOut.delete(caller.profileId);
      return route.fulfill({ status: 204 });
    }
    if (method === 'GET' && url.pathname === '/api/announcements') {
      return this.list(route, url, caller);
    }
    const sender = holds(caller, 'SendAnnouncements');

    if (method === 'POST' && url.pathname === '/api/announcements/recipient-count') {
      if (!sender) return route.fulfill({ status: 403 });
      return route.fulfill({ status: 200, json: { count: this.recipients(body).length } });
    }
    if (method === 'POST' && url.pathname === '/api/announcements') {
      const subject = String(body['subject'] ?? '').trim();
      const text = String(body['body'] ?? '').trim();
      const errors: Record<string, string[]> = {};
      if (!subject) errors['Subject'] = ['Add a subject so people know what it’s about.'];
      if (!text) errors['Body'] = ['Write a message of at least one sentence.'];
      if (Object.keys(errors).length)
        return route.fulfill({ status: 400, json: { status: 400, errors } });
      if (!sender) return route.fulfill({ status: 403 });
      const audience = body['audience'] as MockAnnouncement['audience'];
      const recipients = this.recipients(audience);
      const alsoEmail = body['alsoEmail'] !== false;
      const announcement = this.add({
        subject,
        body: text,
        audience,
        senderId: caller.profileId,
        alsoEmail,
        recipientIds: recipients.map((r) => r.profileId),
      });
      for (const recipient of recipients) {
        this.context.notifications.add({
          recipientId: recipient.profileId,
          kind: 'Announcement',
          title: subject,
          linkPath: '/announcements',
          actorId: caller.profileId,
          actorName: caller.name,
        });
      }
      const emailCount = alsoEmail
        ? recipients.filter((r) => !this.optedOut.has(r.profileId)).length
        : 0;
      return route.fulfill({
        status: 201,
        json: { id: announcement.id, recipientCount: recipients.length, emailCount },
      });
    }
    return undefined;
  }

  /** An announcement already sent, newest last. */
  add(
    announcement: Omit<MockAnnouncement, 'id' | 'sentAt'> & { sentAt?: string },
  ): MockAnnouncement {
    const full: MockAnnouncement = {
      id: `announcement-${this.announcements.length + 1}`,
      sentAt: this.context.now.toISOString(),
      ...announcement,
    };
    this.announcements.push(full);
    return full;
  }

  /** GET /api/announcements: those sent to the caller or by them, newest first, 25 to a page. */
  private list(route: Route, url: URL, caller: MockAccount): Promise<void> {
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const mine = this.announcements
      .filter((a) => a.senderId === caller.profileId || a.recipientIds.includes(caller.profileId))
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    const accounts = [...this.context.accounts.values()];
    const items = mine.slice((page - 1) * 25, page * 25).map((a) => ({
      id: a.id,
      subject: a.subject,
      body: a.body,
      sentAt: a.sentAt,
      senderName: accounts.find((x) => x.profileId === a.senderId)?.name ?? '',
      audienceKind: a.audience.kind,
      roles: a.audience.roles ?? [],
      eventTitle:
        this.context.events.events.find((e) => e.id === a.audience.eventId)?.title ?? null,
      recipientCount: a.recipientIds.length,
    }));
    return route.fulfill({
      status: 200,
      json: { items, page, pageSize: 25, totalCount: mine.length },
    });
  }

  private recipients(
    audience: Record<string, unknown> | MockAnnouncement['audience'],
  ): MockAccount[] {
    const members = [...this.context.accounts.values()].filter((a) => !a.suspended);
    const kind = audience['kind' as keyof typeof audience];
    if (kind === 'Roles') {
      const roles = (audience['roles' as keyof typeof audience] ?? []) as string[];
      return members.filter((a) => a.roles.some((r) => roles.includes(r)));
    }
    if (kind === 'EventRsvps') {
      const event = this.context.events.events.find(
        (e) => e.id === audience['eventId' as keyof typeof audience],
      );
      const going = new Set(event?.rsvps.map((r) => r.profileId) ?? []);
      return members.filter((a) => going.has(a.profileId));
    }
    return members;
  }
}
