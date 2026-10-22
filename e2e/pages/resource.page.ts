import { Locator, Page } from '@playwright/test';

/** One resource at /resources/{id} (docs/mocks/pages/resource). */
export class ResourcePage {
  readonly heading: Locator;
  readonly breadcrumb: Locator;
  readonly subtitle: Locator;
  readonly download: Locator;
  readonly openLink: Locator;
  readonly edit: Locator;
  readonly archive: Locator;
  readonly transfer: Locator;
  readonly restore: Locator;
  readonly changeWhoCanSee: Locator;
  readonly banner: Locator;
  readonly details: Locator;
  readonly preview: Locator;
  readonly audience: Locator;
  readonly missing: Locator;
  readonly browse: Locator;
  readonly toast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    this.subtitle = page.locator('.subtitle');
    this.download = page.getByRole('button', { name: /^Download/ });
    this.openLink = page.getByRole('link', { name: /^Open on .* \(opens in a new tab\)$/ });
    this.edit = page.getByRole('button', { name: 'Edit', exact: true });
    this.archive = page.getByRole('button', { name: 'Archive', exact: true });
    this.transfer = page.getByRole('button', { name: 'Transfer ownership' });
    this.restore = page.getByRole('button', { name: 'Restore', exact: true });
    this.changeWhoCanSee = page.getByRole('button', { name: 'Change who can see it' });
    this.banner = page.locator('ft-banner');
    this.details = page.locator('ft-description-list');
    this.preview = page.locator('.preview');
    this.audience = page.getByRole('list', { name: 'Shared with' });
    this.missing = page.getByRole('heading', { name: 'This resource isn’t available' });
    this.browse = page.getByRole('link', { name: 'Browse resources' });
    this.toast = page.locator('ft-toast').last();
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/resources/${id}`);
  }

  detail(label: string): Locator {
    return this.page.locator(`ft-description-list-item[label="${label}"]`);
  }
}
