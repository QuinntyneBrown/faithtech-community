import { Locator, Page } from '@playwright/test';

/** The workspaces page at /workspaces (docs/mocks/pages/workspaces). */
export class WorkspacesPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly newWorkspace: Locator;
  readonly items: Locator;
  readonly empty: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  readonly readOnly: Locator;
  readonly toast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header p');
    this.newWorkspace = page.getByRole('button', { name: 'New workspace' }).first();
    this.items = page.getByRole('list', { name: 'Workspaces' }).getByRole('listitem');
    this.empty = page.getByRole('heading', { name: 'Create your first workspace' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load your workspaces' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.readOnly = page.locator('ft-alert').filter({ hasText: 'Read-only for Staff' });
    this.toast = page.locator('ft-toast');
  }

  async open(): Promise<void> {
    await this.page.goto('/workspaces');
  }

  item(name: string): Locator {
    return this.items.filter({ has: this.page.getByRole('link', { name, exact: true }) });
  }

  /** The "Owner" badge on a workspace the caller owns. */
  ownerBadge(name: string): Locator {
    return this.item(name).locator('ft-badge');
  }

  link(name: string): Locator {
    return this.page.getByRole('link', { name, exact: true });
  }
}
