import { Locator, Page } from '@playwright/test';

/** Reports, /reports (docs/mocks/pages/reports). */
export class ReportsPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly city: Locator;
  readonly period: Locator;
  readonly apply: Locator;
  readonly exportCsv: Locator;
  readonly loading: Locator;
  readonly empty: Locator;
  readonly error: Locator;
  readonly tryAgain: Locator;
  readonly forbidden: Locator;
  readonly goHome: Locator;
  readonly filterAlert: Locator;
  readonly toasts: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header').getByText(/ · /).first();
    this.city = page.getByRole('combobox', { name: 'City' });
    this.period = page.getByRole('combobox', { name: 'Period' });
    this.apply = page.getByRole('button', { name: 'Apply' });
    this.exportCsv = page.getByRole('button', { name: /^(Export CSV|Exporting…)$/ });
    this.loading = page.getByRole('status', { name: 'Loading reports' });
    this.empty = page.getByRole('heading', { name: /^Nothing to report for / });
    this.error = page.getByRole('heading', { name: 'We couldn’t load the reports' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.forbidden = page.getByRole('heading', { name: 'Reports are for Staff and System Admin' });
    this.goHome = page.getByRole('link', { name: 'Go to Home' });
    this.filterAlert = page.locator('ft-alert').filter({
      hasText: 'We couldn’t use that filter, so this shows all cities for the last 30 days.',
    });
    this.toasts = page.locator('ft-toast-region ft-toast');
  }

  async open(query = ''): Promise<void> {
    await this.page.goto(`/reports${query}`);
  }

  /** Picks the filters and chooses Apply. */
  async filter(city: string, period: string): Promise<void> {
    await this.city.selectOption({ label: city });
    await this.period.selectOption({ label: period });
    await this.apply.click();
  }

  /** The figure named `label` (Members, Events held, RSVPs, Partners confirmed, Announcements). */
  figure(label: string): Locator {
    return this.page.getByRole('group', { name: label, exact: true });
  }

  async figureText(label: string): Promise<string> {
    return (await this.figure(label).innerText()).replace(/\s+/g, ' ').trim();
  }

  /** Each bar's text, "Toronto 3", for the chart named `title`. */
  async chartRows(title: string): Promise<string[]> {
    const rows = this.page.getByRole('list', { name: title }).getByRole('listitem');
    return (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  }

  chart(title: string): Locator {
    return this.page.getByRole('list', { name: title });
  }

  /** The body rows of the table under the card heading `title`, as their cells' text. */
  async tableRows(title: string): Promise<string[][]> {
    const rows = this.card(title).getByRole('row');
    const all = await rows.evaluateAll((trs) =>
      trs
        .filter((tr) => !tr.closest('thead'))
        .map((tr) =>
          [...tr.querySelectorAll('th, td')].map((c) =>
            (c.textContent ?? '').replace(/\s+/g, ' ').trim(),
          ),
        ),
    );
    return all;
  }

  card(title: string): Locator {
    return this.page.locator('ft-card').filter({
      has: this.page.getByRole('heading', { name: title, exact: true }),
    });
  }

  eventLink(title: string): Locator {
    return this.card('Events and attendance').getByRole('link', { name: title });
  }

  /** The cities the City filter offers, in order. */
  async cityOptions(): Promise<string[]> {
    return (await this.city.locator('option').allTextContents()).map((t) => t.trim());
  }

  async periodOptions(): Promise<string[]> {
    return (await this.period.locator('option').allTextContents()).map((t) => t.trim());
  }

  emptyAction(name: string): Locator {
    return this.page.locator('ft-empty-state').getByRole('button', { name, exact: true });
  }

  toast(heading: string): Locator {
    return this.toasts.filter({ hasText: heading });
  }
}
