import { Locator, Page } from '@playwright/test';

/** One page at /notes/{id}: the editor, or the read-only view (docs/mocks/pages/note). */
export class NotePage {
  readonly heading: Locator;
  readonly title: Locator;
  readonly breadcrumb: Locator;
  readonly content: Locator;
  readonly blocks: Locator;
  readonly saveStatus: Locator;
  readonly banner: Locator;
  readonly missing: Locator;
  readonly browse: Locator;
  readonly toast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.title = page.getByRole('textbox', { name: 'Page title' });
    this.breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    this.content = page.getByRole('region', { name: 'Page content' });
    this.blocks = this.content.locator('.block');
    this.saveStatus = page.locator('ft-save-status');
    this.banner = page.locator('ft-banner');
    this.missing = page.getByRole('heading', { name: 'This page isn’t available' });
    this.browse = page.getByRole('link', { name: 'Browse notes' });
    this.toast = page.locator('ft-toast').last();
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/notes/${id}`);
  }
}
