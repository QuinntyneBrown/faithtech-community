import { Locator, Page } from '@playwright/test';

/** The owner's archived pages at /notes/archived (docs/mocks/pages/archived-notes). */
export class ArchivedNotesPage {
  readonly heading: Locator;
  readonly items: Locator;
  readonly empty: Locator;
  readonly error: Locator;
  readonly toast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.items = page.getByRole('list', { name: 'Archived pages' }).getByRole('listitem');
    this.empty = page.getByRole('heading', { name: 'Nothing archived' });
    this.error = page.getByRole('heading', { name: 'We couldn’t load your archived pages' });
    this.toast = page.locator('ft-toast').last();
  }

  async open(): Promise<void> {
    await this.page.goto('/notes/archived');
  }

  restore(title: string): Locator {
    return this.page.getByRole('button', { name: `Restore ${title}` });
  }
}
