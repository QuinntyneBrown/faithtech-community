import { Locator, Page } from '@playwright/test';

/** The marketing app's own dev server (playwright.config.ts starts it next to the community app). */
export const MARKETING_URL = process.env['E2E_MARKETING_URL'] ?? 'http://localhost:4300';

/** The public marketing page at www.faithtech.community (docs/mocks/pages/marketing). */
export class MarketingPage {
  readonly heading: Locator;
  readonly eyebrow: Locator;
  readonly lead: Locator;
  readonly topBar: Locator;
  readonly topBarJoin: Locator;
  readonly topBarSignIn: Locator;
  readonly benefitsHeading: Locator;
  readonly benefits: Locator;
  readonly callToAction: Locator;
  readonly callToActionJoin: Locator;
  readonly footer: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {
      level: 1,
      name: 'Build with people who share your faith',
    });
    this.eyebrow = page.getByText('FaithTech Community', { exact: true });
    this.lead = page.getByText(/^Meet the builders, leads and volunteers in your city/);
    this.topBar = page.getByRole('banner');
    this.topBarJoin = this.topBar.getByRole('button', { name: 'Join now' });
    this.topBarSignIn = this.topBar.getByRole('button', { name: 'Sign in' });
    this.benefitsHeading = page.getByRole('heading', { level: 2, name: 'Why join' });
    this.benefits = page.getByRole('heading', { level: 3 });
    this.callToAction = page.getByRole('region', { name: 'Ready to build with us?' });
    this.callToActionJoin = this.callToAction.getByRole('button', { name: 'Join now' });
    this.footer = page.getByRole('contentinfo');
  }

  async open(query = ''): Promise<void> {
    await this.page.goto(`${MARKETING_URL}/${query}`);
  }
}
