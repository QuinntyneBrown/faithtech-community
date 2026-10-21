import { Locator, Page } from '@playwright/test';

import { fieldError } from './sign-in.page';

export class ForgotPasswordPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly submit: Locator;
  readonly checkEmail: Locator;
  readonly summary: Locator;
  readonly emailError: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Reset your password' });
    this.email = page.getByLabel('Email');
    this.submit = page.getByRole('button', { name: /Send reset link|Sending/ });
    this.checkEmail = page.getByRole('heading', { level: 1, name: 'Check your email' });
    this.summary = page.locator('ft-alert [role=alert]');
    this.emailError = fieldError(page, 'Email');
  }

  async open(): Promise<void> {
    await this.page.goto('/forgot-password');
  }

  async request(email: string): Promise<void> {
    await this.email.fill(email);
    await this.submit.click();
  }

  confirmationFor(email: string): Locator {
    return this.page.getByText(`If an account uses ${email}`);
  }
}

export class ResetPasswordPage {
  readonly heading: Locator;
  readonly password: Locator;
  readonly confirm: Locator;
  readonly submit: Locator;
  readonly summary: Locator;
  readonly passwordError: Locator;
  readonly confirmError: Locator;
  readonly updated: Locator;
  readonly expired: Locator;
  readonly sendNewLink: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Choose a new password' });
    this.password = page.getByLabel('New password', { exact: true });
    this.confirm = page.getByLabel('Confirm new password');
    this.submit = page.getByRole('button', { name: /Save password|Saving/ });
    this.summary = page.locator('ft-alert [role=alert]');
    this.passwordError = fieldError(page, 'New password');
    this.confirmError = fieldError(page, 'Confirm new password');
    this.updated = page.getByRole('heading', { level: 1, name: 'Password updated' });
    this.expired = page.getByRole('heading', { level: 1, name: 'This reset link has expired' });
    this.sendNewLink = page.getByRole('link', { name: 'Send a new link' });
  }

  /** Opens the page the way the reset email's link does. */
  async openLink(userId: string, token: string): Promise<void> {
    await this.page.goto(
      `/reset-password?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`,
    );
  }

  async save(password: string, confirm = password): Promise<void> {
    await this.password.fill(password);
    await this.confirm.fill(confirm);
    await this.submit.click();
  }
}
