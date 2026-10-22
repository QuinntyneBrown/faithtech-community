import { Locator, Page } from '@playwright/test';

/** The owner's archived resources at /resources/archived (docs/mocks/pages/archived-resources). */
export class ArchivedResourcesPage {
  readonly heading: Locator;
  readonly items: Locator;
  readonly empty: Locator;
  readonly toast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.items = page.getByRole('list', { name: 'Archived resources' }).getByRole('listitem');
    this.empty = page.getByRole('heading', { name: 'Nothing archived' });
    this.toast = page.locator('ft-toast').last();
  }

  async open(): Promise<void> {
    await this.page.goto('/resources/archived');
  }

  item(title: string): Locator {
    return this.items.filter({ hasText: title });
  }

  restore(title: string): Locator {
    return this.page.getByRole('button', { name: `Restore ${title}` });
  }
}
