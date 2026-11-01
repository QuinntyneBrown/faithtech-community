import { Locator, Page } from '@playwright/test';

/**
 * The hub page at /public/events/:id/hub (docs/mocks/pages/hub-page): the preview banner, the shown sections in order,
 * and the empty, failed and not-available states.
 */
export class HubPage {
  readonly main: Locator;
  readonly banner: Locator;
  readonly backToHubHome: Locator;
  readonly sectionHeadings: Locator;
  readonly nothingYet: Locator;
  readonly notAvailable: Locator;
  readonly failed: Locator;
  readonly tryAgain: Locator;
  readonly signIn: Locator;
  readonly rsvp: Locator;
  readonly agendaRows: Locator;
  readonly currentAgendaRow: Locator;
  readonly agendaAnnouncement: Locator;
  readonly agendaFinished: Locator;

  constructor(private readonly page: Page) {
    this.main = page.getByRole('main');
    this.banner = page.locator('.hub-page__banner');
    this.backToHubHome = page.getByRole('link', { name: 'Back to hub home' });
    this.sectionHeadings = this.main.getByRole('heading', { level: 3 });
    this.nothingYet = page.getByRole('heading', { name: 'Nothing to show yet' });
    this.notAvailable = page.getByRole('heading', { name: 'This hub isn’t available' });
    this.failed = page.getByText('We couldn’t load the hub');
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.signIn = page.getByRole('main').getByRole('link', { name: 'Sign in' });
    this.rsvp = page.getByRole('main').getByRole('link', { name: 'RSVP' });
    const agenda = this.main.getByRole('region', { name: 'Agenda' });
    this.agendaRows = agenda.getByRole('listitem');
    this.currentAgendaRow = agenda.locator('[aria-current="time"]');
    this.agendaAnnouncement = agenda.getByRole('status');
    // The visible line, not the live region that may say the same.
    this.agendaFinished = agenda
      .getByText('This event has finished.', { exact: true })
      .and(agenda.locator(':not([role="status"])'));
  }

  async open(eventId: string): Promise<void> {
    await this.page.goto(`/public/events/${eventId}/hub`);
  }

  /** The Agenda row whose title is `title`. */
  agendaRow(title: string): Locator {
    return this.agendaRows.filter({ hasText: title });
  }

  /** Whether the page is wider than the window, so it would scroll sideways. */
  scrollsSideways(): Promise<boolean> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
  }

  /** The page's meta description. */
  description(): Promise<string | null> {
    return this.page.locator('meta[name="description"]').getAttribute('content');
  }

  /** Text on the page, such as a section's line. */
  text(text: string): Locator {
    return this.main.getByText(text, { exact: true });
  }
}
