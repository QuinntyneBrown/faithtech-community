import { Locator, Page } from '@playwright/test';

/** The hub home at /events/:id/hub (docs/mocks/pages/event-hub). */
export class EventHubPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly status: Locator;
  readonly link: Locator;
  readonly copyLink: Locator;
  readonly progress: Locator;
  readonly rows: Locator;
  readonly forbidden: Locator;
  readonly noHub: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  readonly backToEvent: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('main .ft-page-header__subtitle, main .subtitle').first();
    this.status = page
      .locator('dt', { hasText: 'Status' })
      .locator('xpath=following-sibling::dd[1]');
    this.link = page.getByLabel('Link', { exact: true });
    this.copyLink = page.getByRole('button', { name: 'Copy link' });
    this.progress = page.getByRole('progressbar');
    this.rows = page.getByRole('list', { name: 'Sections' }).getByRole('listitem');
    this.forbidden = page.getByRole('heading', { name: 'You can’t manage event hubs' });
    this.noHub = page.getByRole('heading', { name: 'This event has no hub yet' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load this hub' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.backToEvent = page.getByRole('link', { name: 'Back to event' });
  }

  async open(eventId: string): Promise<void> {
    await this.page.goto(`/events/${eventId}/hub`);
  }

  /** The row of a section, by its title. */
  row(title: string): Locator {
    return this.rows.filter({ has: this.page.getByText(title, { exact: true }) });
  }

  /** Each row as "Title: State", in order. */
  async summary(): Promise<string[]> {
    const rows = await this.rows.all();
    return Promise.all(
      rows.map(async (r) => {
        const title = (await r.locator('.ft-checklist-row__title').textContent())?.trim();
        const state = (await r.locator('ft-badge').textContent())?.trim();
        return `${title}: ${state}`;
      }),
    );
  }
}
