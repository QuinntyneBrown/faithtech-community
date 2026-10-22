import { Locator, Page } from '@playwright/test';

/** The top bar's bell and its panel (docs/mocks/notifications/bell). */
export class NotificationBell {
  /** Named "Notifications" or "Notifications, 3 unread". */
  readonly button: Locator;
  readonly panel: Locator;
  readonly notices: Locator;
  readonly markAllRead: Locator;
  readonly seeAll: Locator;
  readonly caughtUp: Locator;

  constructor(private readonly page: Page) {
    this.button = page.locator('header').getByRole('button', { name: /^Notifications/ });
    this.panel = page.getByRole('dialog', { name: 'Notifications' });
    this.notices = this.panel.getByRole('listitem');
    this.markAllRead = this.panel.getByRole('button', { name: 'Mark all read' });
    this.seeAll = this.panel.getByRole('link', { name: 'See all' });
    this.caughtUp = this.panel.getByText('You’re all caught up');
  }

  async open(): Promise<void> {
    await this.button.click();
  }

  /** The notices' sentences, top to bottom. */
  async titles(): Promise<string[]> {
    return (await this.notices.getByRole('link').allTextContents()).map((t) => t.trim());
  }

  /** Follows a notice's link, which marks it read and opens its item. */
  async openNotice(title: string): Promise<void> {
    await this.panel.getByRole('link', { name: title }).click();
  }
}

/** The notifications page at /notifications (docs/mocks/pages/notifications). */
export class NotificationsPage {
  readonly heading: Locator;
  readonly notices: Locator;
  readonly markAllRead: Locator;
  readonly all: Locator;
  readonly unread: Locator;
  readonly empty: Locator;
  readonly showOlder: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Notifications' });
    this.notices = page
      .getByRole('main')
      .getByRole('list', { name: 'Notifications' })
      .getByRole('listitem');
    this.markAllRead = page.getByRole('button', { name: 'Mark all as read' });
    const filters = page.getByRole('group', { name: 'Show notifications' });
    this.all = filters.getByRole('button', { name: 'All' });
    this.unread = filters.getByRole('button', { name: 'Unread' });
    this.empty = page.getByRole('heading', { name: 'You’re all caught up' });
    this.showOlder = page.getByRole('button', { name: 'Show older notifications' });
  }

  async open(): Promise<void> {
    await this.page.goto('/notifications');
  }

  async titles(): Promise<string[]> {
    return (await this.notices.getByRole('link').allTextContents()).map((t) => t.trim());
  }

  /** The notices that say "Unread" in their meta line. */
  unreadNotices(): Locator {
    return this.notices.filter({ hasText: 'Unread' });
  }
}
