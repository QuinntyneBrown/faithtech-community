import { Locator, Page } from '@playwright/test';

/** Archived contacts at /contacts/archived (docs/mocks/pages/archived-contacts). */
export class ArchivedContactsPage {
  readonly heading: Locator;
  readonly items: Locator;
  readonly empty: Locator;
  readonly toast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.items = page.getByRole('list', { name: 'Archived contacts' }).getByRole('listitem');
    this.empty = page.getByRole('heading', { name: 'Nothing archived' });
    this.toast = page.locator('ft-toast');
  }

  async open(): Promise<void> {
    await this.page.goto('/contacts/archived');
  }

  item(name: string): Locator {
    return this.items.filter({ hasText: name });
  }

  restore(name: string): Locator {
    return this.page.getByRole('button', { name: `Restore ${name}` });
  }

  delete(name: string): Locator {
    return this.page.getByRole('button', { name: `Delete ${name} permanently` });
  }
}
