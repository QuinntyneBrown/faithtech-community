import { Locator, Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

/** The not-found, forbidden, server-error and offline pages, and the offline banner. */
export class ErrorPages {
  readonly notFound: Locator;
  readonly forbidden: Locator;
  readonly serverError: Locator;
  readonly offline: Locator;
  readonly goHome: Locator;
  readonly search: Locator;
  readonly tryAgain: Locator;
  readonly offlineBanner: Locator;
  /** The public shell's Sign in, in the top bar a signed-out visitor sees. */
  readonly topBarSignIn: Locator;

  constructor(private readonly page: Page) {
    this.notFound = page.getByRole('heading', { level: 1, name: 'We can’t find that page' });
    this.forbidden = page.getByRole('heading', { level: 1, name: 'You don’t have access to this' });
    this.serverError = page.getByRole('heading', {
      level: 1,
      name: 'Something went wrong on our side',
    });
    this.offline = page.getByRole('heading', { level: 1, name: 'You’re offline' });
    const main = page.getByRole('main');
    this.goHome = main.getByRole('link', { name: 'Go home' });
    this.search = main.getByRole('link', { name: 'Search', exact: true });
    this.tryAgain = main.getByRole('button', { name: 'Try again' });
    this.offlineBanner = page.locator('ft-banner').filter({ hasText: 'No connection' });
    this.topBarSignIn = page.getByRole('banner').getByRole('link', { name: 'Sign in' });
  }

  reference(id: string): Locator {
    return this.page.getByText(`Reference: ${id}`);
  }

  /** The top bar's capsule and the offline banner, to check the banner sits below the bar. */
  async barAndBanner(): Promise<{ bar: Box; banner: Box }> {
    const bar = await this.page.locator('header.top-bar').boundingBox();
    const banner = await this.offlineBanner.boundingBox();
    if (!bar || !banner) throw new Error('The top bar or the offline banner is not on screen');
    return { bar, banner };
  }
}
