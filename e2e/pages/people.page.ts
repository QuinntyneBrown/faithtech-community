import { Locator, Page } from '@playwright/test';

/** The People and roles page at /people (docs/mocks/pages/people). */
export class PeoplePage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly search: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly skeleton: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  readonly forbidden: Locator;
  readonly backToHome: Locator;
  readonly inviteSomeone: Locator;
  readonly showMore: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header p');
    this.search = page.getByRole('searchbox', { name: 'Search people' });
    this.table = page.getByRole('table', { name: 'Members and their roles' });
    this.rows = this.table.locator('tbody tr');
    this.skeleton = page.getByLabel('Loading people');
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load people' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.forbidden = page.getByRole('heading', { name: 'Only City Leads manage roles' });
    this.backToHome = page.getByRole('link', { name: 'Back to home' });
    this.inviteSomeone = page.getByRole('link', { name: 'Invite someone' });
    this.showMore = page.getByRole('button', { name: 'Show more people' });
  }

  async open(): Promise<void> {
    await this.page.goto('/people');
  }

  async searchFor(term: string): Promise<void> {
    await this.search.fill(term);
    await this.search.press('Enter');
  }

  row(name: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('link', { name, exact: true }) });
  }

  profileLink(name: string): Locator {
    return this.row(name).getByRole('link', { name, exact: true });
  }

  photo(name: string): Locator {
    return this.row(name).locator('img');
  }

  addRole(name: string): Locator {
    return this.page.getByRole('button', { name: `Add role to ${name}` });
  }

  removeRole(name: string): Locator {
    return this.page.getByRole('button', { name: `Remove a role from ${name}` });
  }

  noResults(term: string): Locator {
    return this.page.getByRole('heading', { name: `No one matches “${term}”` });
  }

  async names(): Promise<string[]> {
    return this.rows.locator('td:first-child a').allTextContents();
  }
}
