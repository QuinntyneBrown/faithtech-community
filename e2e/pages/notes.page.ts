import { Locator, Page } from '@playwright/test';

/** The Notes list at /notes (docs/mocks/pages/notes). */
export class NotesPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly items: Locator;
  readonly itemTitles: Locator;
  readonly search: Locator;
  readonly newPage: Locator;
  readonly archived: Locator;
  readonly clearSearch: Locator;
  readonly showMore: Locator;
  readonly empty: Locator;
  readonly createFirst: Locator;
  readonly error: Locator;
  readonly tryAgain: Locator;
  readonly loading: Locator;
  readonly toast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header').getByText(/^Meeting notes, playbooks/);
    this.items = page.getByRole('list', { name: 'Notes' }).getByRole('listitem');
    this.itemTitles = this.items.locator('.ft-list-item__title');
    this.search = page.getByRole('searchbox', { name: 'Search notes' });
    this.newPage = page.getByRole('button', { name: 'New page', exact: true });
    this.archived = page.getByRole('link', { name: 'Archived' });
    this.clearSearch = page.getByRole('button', { name: 'Clear search' });
    this.showMore = page.getByRole('button', { name: 'Show more' });
    this.empty = page.getByRole('heading', { name: 'No pages yet' });
    this.createFirst = page.getByRole('button', { name: 'Create your first page' });
    this.error = page.getByRole('heading', { name: 'We couldn’t load notes' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.loading = page.getByRole('status', { name: 'Loading notes' });
    this.toast = page.locator('ft-toast').last();
  }

  async open(query = ''): Promise<void> {
    await this.page.goto(`/notes${query}`);
  }

  owner(name: 'All pages' | 'Mine' | 'Shared with me'): Locator {
    return this.page
      .getByRole('group', { name: 'Owner' })
      .getByRole('button', { name, exact: true });
  }

  item(title: string): Locator {
    return this.items.filter({ has: this.page.getByRole('link', { name: title, exact: true }) });
  }

  noResults(term: string): Locator {
    return this.page.getByRole('heading', { name: `No pages match “${term}”` });
  }
}
