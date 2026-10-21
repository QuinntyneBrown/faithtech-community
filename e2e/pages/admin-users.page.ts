import { Locator, Page } from '@playwright/test';

/** The admin users page at /admin/users (docs/mocks/pages/admin-users). */
export class AdminUsersPage {
  readonly heading: Locator;
  readonly search: Locator;
  readonly rows: Locator;
  readonly loadError: Locator;
  readonly forbidden: Locator;
  readonly clearSearch: Locator;
  readonly auditLogTab: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.search = page.getByRole('searchbox', { name: 'Search users' });
    this.rows = page.getByRole('table', { name: 'All user accounts' }).locator('tbody tr');
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load users' });
    this.forbidden = page.getByRole('heading', { name: 'This area is for System Admins' });
    this.clearSearch = page.getByRole('button', { name: 'Clear search' });
    this.auditLogTab = page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', {
      name: 'Audit log',
    });
  }

  async open(): Promise<void> {
    await this.page.goto('/admin/users');
  }

  async searchFor(term: string): Promise<void> {
    await this.search.fill(term);
    await this.search.press('Enter');
  }

  row(name: string): Locator {
    return this.rows.filter({ hasText: name });
  }

  noResults(term: string): Locator {
    return this.page.getByRole('heading', { name: `No users match “${term}”` });
  }

  suspend(name: string): Locator {
    return this.page.getByRole('button', { name: `Suspend ${name}` });
  }

  reinstate(name: string): Locator {
    return this.page.getByRole('button', { name: `Reinstate ${name}` });
  }

  profileLink(name: string): Locator {
    return this.row(name).getByRole('link', { name });
  }
}
