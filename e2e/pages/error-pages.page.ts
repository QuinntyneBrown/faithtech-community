import { Locator, Page } from '@playwright/test';

/** The not-found, forbidden and server-error pages, and the offline banner. */
export class ErrorPages {
  readonly notFound: Locator;
  readonly forbidden: Locator;
  readonly serverError: Locator;
  readonly goHome: Locator;
  readonly search: Locator;
  readonly offlineBanner: Locator;

  constructor(private readonly page: Page) {
    this.notFound = page.getByRole('heading', { level: 1, name: 'We can’t find that page' });
    this.forbidden = page.getByRole('heading', { level: 1, name: 'You don’t have access to this' });
    this.serverError = page.getByRole('heading', {
      level: 1,
      name: 'Something went wrong on our side',
    });
    this.goHome = page.getByRole('link', { name: 'Go home' });
    this.search = page.getByRole('link', { name: 'Search' });
    this.offlineBanner = page.locator('ft-banner').filter({ hasText: 'No connection' });
  }

  reference(id: string): Locator {
    return this.page.getByText(`Reference: ${id}`);
  }
}
