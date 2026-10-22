import { Locator, Page } from '@playwright/test';
import { fieldError } from './sign-in.page';

export class VerifyEmailPage {
  readonly pending: Locator;
  readonly verified: Locator;
  readonly expired: Locator;
  readonly sendNewLink: Locator;
  readonly email: Locator;
  readonly emailError: Locator;
  readonly message: Locator;
  readonly setUpProfile: Locator;

  constructor(private readonly page: Page) {
    this.pending = page.getByRole('heading', { level: 1, name: 'Verify your email' });
    this.verified = page.getByRole('heading', { level: 1, name: /You’re in/ });
    this.expired = page.getByRole('heading', { level: 1, name: 'This link has expired' });
    this.sendNewLink = page.getByRole('button', { name: /Send a new link|Sending/ });
    this.email = page.getByLabel('Email');
    this.emailError = fieldError(page, 'Email');
    this.message = page.locator('ft-alert [role=status], ft-alert [role=alert]');
    this.setUpProfile = page.getByRole('link', { name: 'Set up my profile' });
  }

  /** Opens the page the way the verification email's link does. */
  async openLink(userId: string, token: string): Promise<void> {
    await this.page.goto(
      `/verify-email?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`,
    );
  }

  async openPending(email: string): Promise<void> {
    await this.page.goto(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  sentTo(email: string): Locator {
    return this.page.getByText(`Open the link we sent to ${email}`);
  }
}
