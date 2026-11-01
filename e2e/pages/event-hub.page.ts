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
  readonly reorder: Locator;
  readonly preview: Locator;

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
    this.reorder = page.getByRole('button', { name: 'Reorder sections' });
    this.preview = page.getByRole('link', { name: 'Preview', exact: true });
  }

  /** "More for {Section}", the row's menu of Preview and Hide section (L2-156 AC1). */
  more(title: string): Locator {
    return this.page.getByRole('button', { name: `More for ${title}`, exact: true });
  }

  /** An item of the open row menu, such as "Hide section". */
  menuItem(name: string): Locator {
    return this.page.getByRole('menuitem', { name, exact: true });
  }

  /** A row button by its visible name and the section, such as Show Giving or Fill in Agenda. */
  action(name: string, title: string): Locator {
    return this.page.getByRole('button', { name: `${name} ${title}`, exact: true });
  }

  /** Opens a section's wizard from its row, by Fill in or Edit. */
  async openWizard(title: string): Promise<void> {
    await this.row(title)
      .getByRole('button', { name: new RegExp(`^(Fill in|Edit) ${title}$`) })
      .click();
  }

  /** A row's one line, saying what visitors see or what is missing. */
  line(title: string): Locator {
    return this.row(title).locator('.ft-checklist-row__text');
  }

  /** A success or danger toast by its heading. */
  toast(heading: string): Locator {
    return this.page.locator('ft-toast').filter({ hasText: heading });
  }

  /** The section titles in order. */
  async titles(): Promise<string[]> {
    return (await this.rows.locator('.ft-checklist-row__title').allTextContents()).map((t) =>
      t.trim(),
    );
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
