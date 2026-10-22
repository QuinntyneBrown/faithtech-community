import { Locator, Page } from '@playwright/test';

/** Global search at /search (docs/mocks/pages/search), and the top bar's search box. */
export class SearchPage {
  readonly heading: Locator;
  readonly field: Locator;
  readonly submit: Locator;
  readonly topBarField: Locator;
  readonly hint: Locator;
  readonly status: Locator;
  readonly groups: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = page.getByRole('heading', { level: 1, name: 'Search' });
    this.field = main.getByRole('searchbox', { name: 'Search' });
    this.submit = main.getByRole('button', { name: 'Search' });
    this.topBarField = page.locator('header').getByRole('searchbox', { name: 'Search FaithTech' });
    this.hint = main.getByText('Type at least 2 characters to search.');
    this.status = main.getByRole('status').filter({ hasText: /results? for/ });
    this.groups = main.locator('section').filter({ has: page.getByRole('heading', { level: 2 }) });
  }

  async open(term?: string): Promise<void> {
    await this.page.goto(term === undefined ? '/search' : `/search?q=${encodeURIComponent(term)}`);
  }

  async searchFor(term: string): Promise<void> {
    await this.field.fill(term);
    await this.submit.click();
  }

  async searchFromTopBar(term: string): Promise<void> {
    await this.topBarField.fill(term);
    await this.topBarField.press('Enter');
  }

  /** The group headings in order, such as "People (1)". */
  async groupHeadings(): Promise<string[]> {
    return (await this.groups.getByRole('heading', { level: 2 }).allTextContents()).map((t) =>
      t.trim(),
    );
  }

  /** The result titles of the group whose heading starts with `group`, such as "Partners". */
  async titles(group: string): Promise<string[]> {
    const section = this.groups.filter({
      has: this.page.getByRole('heading', { level: 2, name: new RegExp(`^${group}`) }),
    });
    return (await section.getByRole('link').allTextContents()).map((t) => t.trim());
  }

  noResults(term: string): Locator {
    return this.page.getByRole('heading', { name: `No results for “${term}”` });
  }
}
