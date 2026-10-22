import { Route } from '@playwright/test';

import type { MockAccount } from './mock-api';
import type { MockEvents } from './mock-events';
import type { MockNotifications } from './mock-notifications';

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

const SENDERS = ['CommunicationsLead', 'SystemAdmin'];

/**
 * Plays the announcements endpoints (backend/src/FaithTech.Community.Api/Endpoints/AnnouncementsEndpoints.cs):
 * the audience resolves to members who are not suspended, and only Communications Leads and System Admins
 * may count or send (L2-029).
 */
export class MockAnnouncements {
  readonly announcements: MockAnnouncement[] = [];
  /** Profile ids of members who turned announcement emails off (L2-030). */
  readonly optedOut = new Set<string>();

  constructor(private readonly context: AnnouncementsContext) {}

  handle(
    route: Route,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    caller: MockAccount | null,
  ): Promise<void> | undefined {
    if (!url.pathname.startsWith('/api/announcements')) return undefined;
    if (!caller) return route.fulfill({ status: 401 });
    const sender = caller.roles.some((r) => SENDERS.includes(r));

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
