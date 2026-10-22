import { Locator, Page } from '@playwright/test';

/** The landing page of an announcement email's unsubscribe link (docs/mocks/pages/unsubscribe). */
export class UnsubscribePage {
  readonly done: Locator;
  readonly invalid: Locator;
  readonly openSettings: Locator;

  constructor(private readonly page: Page) {
    this.done = page.getByRole('heading', { level: 1, name: 'You’re unsubscribed' });
    this.invalid = page.getByRole('heading', {
      level: 1,
      name: 'This unsubscribe link doesn’t work',
    });
    this.openSettings = page.getByRole('link', { name: 'Open settings' });
  }

  /** Opens the link as it appears in the email. */
  async open(token: string): Promise<void> {
    await this.page.goto(`/unsubscribe?token=${encodeURIComponent(token)}`);
  }
}
