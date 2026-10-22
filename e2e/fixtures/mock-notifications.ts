import { Route } from '@playwright/test';

/** A notification as the Notifications table holds it, with the actor's name already joined. */
export interface MockNotification {
  id: string;
  recipientId: string;
  kind: string;
  title: string;
  linkPath: string;
  createdAt: string;
  readAt: string | null;
  actorId: string | null;
  actorName: string | null;
}

const PAGE_SIZE = 50;

/**
 * Plays the notifications endpoints (backend/src/FaithTech.Community.Api/Endpoints/NotificationsEndpoints.cs):
 * each caller lists and marks only their own notifications, newest first, 50 to a page (L2-027).
 */
export class MockNotifications {
  readonly notifications: MockNotification[] = [];

  constructor(private readonly now: () => Date) {}

  /** A notification for `recipientId`; give `minutesAgo` to order them. */
  add(
    notification: Partial<MockNotification> & { recipientId: string; title: string },
    minutesAgo = 0,
  ): MockNotification {
    const full: MockNotification = {
      id: `notification-${this.notifications.length + 1}`,
      kind: 'RoleChanged',
      linkPath: '/people/me',
      createdAt: new Date(this.now().getTime() - minutesAgo * 60_000).toISOString(),
      readAt: null,
      actorId: null,
      actorName: null,
      ...notification,
    };
    this.notifications.push(full);
    return full;
  }

  /** Answers a notifications request for `caller`, or returns undefined for any other path. */
  handle(
    route: Route,
    method: string,
    url: URL,
    caller: { profileId: string } | null,
  ): Promise<void> | undefined {
    if (!url.pathname.startsWith('/api/notifications')) return undefined;
    if (!caller) return route.fulfill({ status: 401 });
    const mine = this.notifications
      .filter((n) => n.recipientId === caller.profileId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const read = /^\/api\/notifications\/([^/]+)\/read$/.exec(url.pathname);

    if (method === 'GET' && url.pathname === '/api/notifications') {
      const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
      const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
      const listed = unreadOnly ? mine.filter((n) => !n.readAt) : mine;
      const items = listed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      return route.fulfill({
        status: 200,
        json: {
          items: items.map(({ recipientId: _, ...dto }) => dto),
          page,
          pageSize: PAGE_SIZE,
          totalCount: listed.length,
          unreadCount: mine.filter((n) => !n.readAt).length,
          hasMore: page * PAGE_SIZE < listed.length,
        },
      });
    }
    if (method === 'GET' && url.pathname === '/api/notifications/unread-count') {
      return route.fulfill({ status: 200, json: { count: mine.filter((n) => !n.readAt).length } });
    }
    if (method === 'POST' && url.pathname === '/api/notifications/read-all') {
      for (const n of mine) n.readAt ??= this.now().toISOString();
      return route.fulfill({ status: 204 });
    }
    if (method === 'POST' && read) {
      const n = mine.find((x) => x.id === read[1]);
      if (!n) return route.fulfill({ status: 404 });
      n.readAt ??= this.now().toISOString();
      return route.fulfill({ status: 204 });
    }
    return undefined;
  }
}
