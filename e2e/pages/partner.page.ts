import { Locator, Page } from '@playwright/test';

/** One partner at /partners/:id (docs/mocks/pages/partner). */
export class PartnerPage {
  readonly heading: Locator;
  readonly stage: Locator;
  readonly edit: Locator;
  readonly moveStage: Locator;
  readonly history: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.stage = page.locator('ft-page-header ft-badge');
    this.edit = page.getByRole('link', { name: 'Edit' });
    this.moveStage = page.getByRole('button', { name: 'Move stage' });
    this.history = page.getByRole('list', { name: 'Stage history' }).getByRole('listitem');
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/partners/${id}`);
  }

  detail(label: string): Locator {
    return this.page
      .locator('dl', { has: this.page.getByText(label, { exact: true }) })
      .locator('dd');
  }
}
