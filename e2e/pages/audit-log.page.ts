import { Locator, Page } from '@playwright/test';

/** The audit log at /admin/audit-log (docs/mocks/pages/audit-log). */
export class AuditLogPage {
  readonly heading: Locator;
  readonly category: Locator;
  readonly rows: Locator;
  readonly exportCsv: Locator;
  readonly showAll: Locator;
  readonly showOlder: Locator;
  readonly empty: Locator;
  readonly forbidden: Locator;
  readonly exportedToast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.category = page.getByLabel('Action');
    this.rows = page.getByRole('table', { name: 'Audit log' }).locator('tbody tr');
    this.exportCsv = page.getByRole('button', { name: /^(Export CSV|Exporting)/ });
    this.showAll = page.getByRole('button', { name: 'Show all actions' });
    this.showOlder = page.getByRole('button', { name: 'Show older entries' });
    this.empty = page.getByRole('heading', { name: 'No admin actions yet' });
    this.forbidden = page.getByRole('heading', { name: 'This area is for System Admins' });
    this.exportedToast = page.locator('ft-toast').filter({ hasText: 'Audit log exported' });
  }

  async open(): Promise<void> {
    await this.page.goto('/admin/audit-log');
  }

  noResults(category: string): Locator {
    return this.page.getByRole('heading', { name: `No ${category} in the last 90 days` });
  }
}
