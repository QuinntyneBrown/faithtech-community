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

  /** The notice whose sentence reads `sentence`. */
  notice(sentence: string): Locator {
    return this.notices.filter({
      has: this.page.locator('.ft-notice__sentence').filter({ hasText: exactly(sentence) }),
    });
  }

  /** The one link of a notice: the item it names, or the whole sentence when it names none. */
  noticeLink(sentence: string): Locator {
    return this.notice(sentence).getByRole('link');
  }

  /** The photo on a notice's avatar; absent when the actor has none. */
  noticePhoto(title: string): Locator {
    return this.notice(title).locator('ft-avatar img');
  }

  async open(sentence: string): Promise<void> {
    await this.noticeLink(sentence).click();
  }

  /** The notices' sentences, top to bottom. */
  async titles(): Promise<string[]> {
    return (await this.notices.locator('.ft-notice__sentence').allTextContents()).map((t) =>
      t.replace(/\s+/g, ' ').trim(),
    );
  }
}

/** Matches the whole text, whitespace-normalised, and nothing longer. */
function exactly(text: string): RegExp {
  return new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}
