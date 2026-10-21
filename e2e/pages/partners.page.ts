import { Locator, Page } from '@playwright/test';

/** The partner pipeline board at /partners (docs/mocks/pages/partners). */
export class PartnersPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly addPartner: Locator;
  readonly board: Locator;
  readonly readOnly: Locator;
  readonly empty: Locator;
  readonly forbidden: Locator;
  readonly toast: Locator;
  readonly stageTabs: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header p');
    this.addPartner = page.getByRole('button', { name: 'Add partner' }).first();
    this.board = page.getByRole('region', { name: 'Partner pipeline' });
    this.readOnly = page.locator('ft-alert', { hasText: 'Read-only for Staff' });
    this.empty = page.getByRole('heading', { name: 'Start your partner pipeline' });
    this.forbidden = page.getByRole('heading', { name: 'The partner pipeline is for leads' });
    this.toast = page.locator('ft-toast');
    this.stageTabs = page.getByRole('navigation', { name: 'Stages' });
  }

  async open(): Promise<void> {
    await this.page.goto('/partners');
  }

  /** A stage column by its heading, e.g. "In funnel". */
  column(title: string): Locator {
    return this.board.getByRole('region', { name: title, exact: true });
  }

  card(name: string): Locator {
    return this.board.getByRole('listitem').filter({ hasText: name });
  }

  move(name: string): Locator {
    return this.page.getByRole('button', { name: `Move ${name} to another stage` });
  }

  stageTab(name: RegExp | string): Locator {
    return this.stageTabs.getByRole('link', { name });
  }
}
