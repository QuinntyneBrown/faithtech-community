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
    await this.dragOver(name, toColumn, 'middle');
    await this.drop();
  }

  /**
   * Picks a card up and holds it over another column without letting go: over the top of the column's
   * first card, so the drop slot opens at the top, or over the middle of the column.
   */
  async dragOver(name: string, toColumn: string, where: 'top' | 'middle' = 'top'): Promise<void> {
    const from = (await this.card(name).boundingBox())!;
    const column = this.column(toColumn);
    const to = (await column.boundingBox())!;
    const first = where === 'top' ? await column.getByRole('listitem').first().boundingBox() : null;
    // Grab the card's padding at its top right, away from its link and Move button, so the lifted
    // card hangs to the left of the pointer and leaves the drop slot in view.
    await this.page.mouse.move(from.x + from.width - 4, from.y + 4);
    await this.page.mouse.down();
    await this.page.mouse.move(from.x + from.width - 20, from.y + 20, { steps: 5 });
    if (first) await this.page.mouse.move(first.x + 8, first.y + 8, { steps: 20 });
    else await this.page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  }

  /** Lets go of the card being dragged. */
  async drop(): Promise<void> {
    await this.page.mouse.up();
  }
}
