import { Locator, Page } from '@playwright/test';

/** Announcements (docs/mocks/pages/announcements). */
export class AnnouncementsPage {
  readonly heading: Locator;
  readonly newAnnouncement: Locator;
  readonly items: Locator;
  readonly emptyState: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { level: 1, name: 'Announcements' });
    this.newAnnouncement = main.getByRole('link', { name: 'New announcement' });
    this.items = main.getByRole('list', { name: 'Announcements' }).getByRole('listitem');
    this.emptyState = main.locator('ft-empty-state');
  }

  async goto(): Promise<void> {
    await this.page.goto('/announcements');
  }

  /** The subjects, top to bottom. */
  async subjects(): Promise<string[]> {
    return (await this.items.locator('.ft-list-item__title').allTextContents()).map((t) =>
      t.trim(),
    );
  }

  item(subject: string): Locator {
    return this.items.filter({ hasText: subject });
  }
}
