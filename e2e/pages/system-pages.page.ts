import { Locator, Page } from '@playwright/test';

/**
 * The neutral pages the server answers a host with before anything of an organisation runs
 * (docs/mocks/pages/unknown-host, docs/mocks/pages/organisation-suspended).
 */
export class SystemPages {
  readonly unknownHost: Locator;
  readonly unknownHostLead: Locator;
  readonly suspended: Locator;
  readonly suspendedLead: Locator;
  readonly images: Locator;
  readonly controls: Locator;

  constructor(private readonly page: Page) {
    this.unknownHost = page.getByRole('heading', { level: 1, name: 'There’s nothing here' });
    this.unknownHostLead = page.getByText('Check the address and try again.');
    this.suspended = page.getByRole('heading', { level: 1, name: 'This site is unavailable' });
    this.suspendedLead = page.getByText(
      'It has been paused. If you belong here, you’ll be able to sign in again once it’s back.',
    );
    this.images = page.locator('img, svg:not([aria-hidden="true"]), picture, video');
    this.controls = page.locator('main').locator('a, button, input, form');
  }

  /** Opens any address on the host, as a visitor would; answers the response status. */
  async open(url: string): Promise<number | undefined> {
    return (await this.page.goto(url))?.status();
  }

  title(): Promise<string> {
    return this.page.title();
  }

  /** Everything the page holds that a person or a crawler could read. */
  everything(): Promise<string> {
    return this.page.content();
  }
}
