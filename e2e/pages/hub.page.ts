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

  constructor(private readonly page: Page) {
    this.main = page.getByRole('main');
    this.banner = page.locator('.hub-page__banner');
    this.backToHubHome = page.getByRole('link', { name: 'Back to hub home' });
    this.sectionHeadings = this.main.getByRole('heading', { level: 3 });
    this.nothingYet = page.getByRole('heading', { name: 'Nothing to show yet' });
    this.notAvailable = page.getByRole('heading', { name: 'This hub isn’t available' });
    this.failed = page.getByText('We couldn’t load the hub');
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
  }

  async open(eventId: string): Promise<void> {
    await this.page.goto(`/public/events/${eventId}/hub`);
  }

  /** Text on the page, such as a section's line. */
  text(text: string): Locator {
    return this.main.getByText(text, { exact: true });
  }
}
