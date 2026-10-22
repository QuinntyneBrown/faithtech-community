import { Locator, Page } from '@playwright/test';

/** The private contacts list at /contacts (docs/mocks/pages/contacts). */
export class ContactsPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly addContact: Locator;
  readonly archived: Locator;
  readonly search: Locator;
  readonly items: Locator;
  readonly empty: Locator;
  readonly forbidden: Locator;
  readonly joinedAlert: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header p');
    this.addContact = page.getByRole('link', { name: 'Add contact' });
    this.archived = page.getByRole('link', { name: 'Archived', exact: true });
    this.search = page.getByRole('searchbox', { name: 'Search contacts' });
    this.items = page.getByRole('list', { name: 'Contacts' }).getByRole('listitem');
    this.empty = page.getByRole('heading', { name: 'No contacts yet' });
    this.forbidden = page.getByRole('heading', { name: 'Contacts are private to each lead' });
    this.joinedAlert = page.locator('ft-alert');
  }

  async open(): Promise<void> {
    await this.page.goto('/contacts');
  }

  item(name: string): Locator {
    return this.items.filter({ hasText: name });
  }

  async searchFor(term: string): Promise<void> {
    await this.search.fill(term);
    await this.search.press('Enter');
  }

  noResults(term: string): Locator {
    return this.page.getByRole('heading', { name: `No contacts match “${term}”` });
  }
}
