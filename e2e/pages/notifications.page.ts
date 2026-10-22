import { Locator, Page } from '@playwright/test';

/** Notifications (docs/mocks/pages/notifications). */
export class NotificationsPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly markAllRead: Locator;
  readonly settings: Locator;
  readonly all: Locator;
  readonly unread: Locator;
  readonly notices: Locator;
  readonly showOlder: Locator;
  readonly emptyState: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { level: 1, name: 'Notifications' });
    this.subtitle = main.locator('ft-page-header').getByText(/unread$/);
    this.markAllRead = main.getByRole('button', { name: 'Mark all as read' });
    this.settings = main.getByRole('link', { name: 'Settings' });
    const filters = main.getByRole('group', { name: 'Show notifications' });
    this.all = filters.getByRole('button', { name: 'All' });
    this.unread = filters.getByRole('button', { name: 'Unread' });
    this.notices = main.getByRole('listitem');
    this.showOlder = main.getByRole('button', { name: 'Show older notifications' });
    this.emptyState = main.locator('ft-empty-state');
  }

  async goto(): Promise<void> {
    await this.page.goto('/notifications');
  }

  /** The notice whose link reads `title`. */
  notice(title: string): Locator {
    return this.notices.filter({ has: this.page.getByRole('link', { name: title, exact: true }) });
  }

  async open(title: string): Promise<void> {
    await this.notice(title).getByRole('link', { name: title, exact: true }).click();
  }

  /** The notices' link texts, top to bottom. */
  async titles(): Promise<string[]> {
    return (await this.notices.getByRole('link').allTextContents()).map((t) => t.trim());
  }
}
