import { Locator, Page } from '@playwright/test';

/** The Resources list at /resources (docs/mocks/pages/resources). */
export class ResourcesPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly items: Locator;
  readonly search: Locator;
  readonly tag: Locator;
  readonly add: Locator;
  readonly archived: Locator;
  readonly clearFilters: Locator;
  readonly clearSearch: Locator;
  readonly filterLine: Locator;
  readonly showMore: Locator;
  readonly empty: Locator;
  readonly addFirst: Locator;
  readonly error: Locator;
  readonly tryAgain: Locator;
  readonly loading: Locator;
  readonly toast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page
      .locator('ft-page-header')
      .getByText(/^Decks, logos, training and templates/);
    this.items = page.getByRole('list', { name: 'Resources' }).getByRole('listitem');
    this.search = page.getByRole('searchbox', { name: 'Search resources' });
    this.tag = page.getByRole('combobox', { name: 'Tag' });
    this.add = page.getByRole('button', { name: 'Add resource' });
    this.archived = page.getByRole('link', { name: 'Archived' });
    this.clearFilters = page.getByRole('button', { name: 'Clear filters' });
    this.clearSearch = page.getByRole('button', { name: 'Clear search' });
    this.filterLine = page.getByRole('status').filter({ hasText: /resources?\b/ });
    this.showMore = page.getByRole('button', { name: 'Show more' });
    this.empty = page.getByRole('heading', { name: 'No resources yet' });
    this.addFirst = page.getByRole('button', { name: 'Add the first resource' });
    this.error = page.getByRole('heading', { name: 'We couldn’t load resources' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.loading = page.getByRole('status', { name: 'Loading resources' });
    this.toast = page.locator('ft-toast').last();
  }

  async open(query = ''): Promise<void> {
    await this.page.goto(`/resources${query}`);
  }

  type(name: string): Locator {
    return this.page
      .getByRole('group', { name: 'Type' })
      .getByRole('button', { name, exact: true });
  }

  item(title: string): Locator {
    return this.items.filter({ has: this.page.getByRole('link', { name: title, exact: true }) });
  }

  titles(): Promise<string[]> {
    return this.items.locator('.ft-list-item__title').allTextContents();
  }

  download(title: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^Download ${escape(title)},`) });
  }

  openLink(title: string): Locator {
    return this.page.getByRole('link', {
      name: new RegExp(`^Open ${escape(title)} on .* \\(opens in a new tab\\)$`),
    });
  }

  noResults(term: string): Locator {
    return this.page.getByRole('heading', { name: `No resources match “${term}”` });
  }
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
