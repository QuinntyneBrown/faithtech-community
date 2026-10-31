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
  readonly announcement: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header p');
    this.addPartner = page.getByRole('button', { name: 'Add partner' }).first();
    this.board = page.getByRole('region', { name: 'Partner pipeline' });
    this.readOnly = page.locator('ft-alert', { hasText: 'Read-only for Staff' });
    this.empty = page.getByRole('heading', { name: 'Start your partner pipeline' });
    this.forbidden = page.getByRole('heading', { name: 'The partner pipeline is for leads' });
    // The newest toast: an earlier one may still be counting down beside it.
    this.toast = page.locator('ft-toast').last();
    this.stageTabs = page.getByRole('tablist', { name: 'Partner pipeline columns' });
    this.announcement = page.locator('ft-kanban-board [aria-live="polite"]');
  }

  async open(): Promise<void> {
    await this.page.goto('/partners');
  }

  /** A stage column by its heading, e.g. "In Funnel". */
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
    return this.stageTabs.getByRole('tab', { name });
  }

  /** Drags a card onto another column with the pointer, in small steps as the CDK expects. */
  async drag(name: string, toColumn: string): Promise<void> {
    const card = this.card(name);
    const target = this.column(toColumn);
    const from = (await card.boundingBox())!;
    const to = (await target.boundingBox())!;
    // Grab the card's padding, away from its link and Move button.
    await this.page.mouse.move(from.x + 4, from.y + 4);
    await this.page.mouse.down();
    await this.page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
    await this.page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
    await this.page.mouse.up();
  }
}
