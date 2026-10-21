import { Locator, Page } from '@playwright/test';

/** The signed-in chrome around every member page. */
export class AppShell {
  readonly verifyBanner: Locator;
  readonly sendVerificationAgain: Locator;

  constructor(private readonly page: Page) {
    this.verifyBanner = page.locator('ft-banner').filter({ hasText: 'Verify your email' });
    this.sendVerificationAgain = this.verifyBanner.getByRole('button', { name: 'Send again' });
  }
}
