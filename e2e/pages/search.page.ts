import { Locator, Page } from '@playwright/test';

/** Search (docs/mocks/pages/search). */
export class SearchPage {
  readonly heading: Locator;
  readonly box: Locator;
  readonly submit: Locator;
  readonly hint: Locator;
  readonly status: Locator;
  readonly emptyState: Locator;
  readonly groups: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { level: 1, name: 'Search' });
    const form = main.getByRole('search');
    this.box = form.getByRole('searchbox', { name: 'Search' });
    this.submit = form.getByRole('button', { name: 'Search' });
    this.hint = form.getByText('Type at least 2 characters to search.');
    this.status = main.getByRole('status').filter({ hasText: /results? for/ });
    this.emptyState = main.locator('ft-empty-state');
    this.groups = main.locator('section[aria-labelledby]');
  }

  async goto(term?: string): Promise<void> {
    await this.page.goto(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
  }

  async searchFor(term: string): Promise<void> {
    await this.box.fill(term);
    await this.submit.click();
  }

  /** The group headings, such as "People (1)", in order. */
  async groupHeadings(): Promise<string[]> {
    return (await this.groups.getByRole('heading', { level: 2 }).allTextContents()).map((t) =>
      t.trim(),
    );
  }

  /** A result link by its title. */
  result(title: string): Locator {
    return this.groups.getByRole('link', { name: title });
  }
}
