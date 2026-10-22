import { Locator, Page } from '@playwright/test';

/** The marketing app's own dev server (playwright.config.ts starts it next to the community app). */
export const MARKETING_URL = process.env['E2E_MARKETING_URL'] ?? 'http://localhost:4300';

/** The public marketing page at www.faithtech.community (docs/mocks/pages/marketing). */
export class MarketingPage {
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {
      level: 1,
      name: 'Build with people who share your faith',
    });
  }

  async open(query = ''): Promise<void> {
    await this.page.goto(`${MARKETING_URL}/${query}`);
  }
}
