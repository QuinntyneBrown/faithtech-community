import { Locator, Page } from '@playwright/test';

import { fieldError } from './sign-in.page';

/** The connect page a City Lead's QR code opens, at /meet/:token (docs/mocks/pages/connect). */
export class ConnectPage {
  readonly heading: Locator;
  readonly leadName: Locator;
  readonly leadMeta: Locator;
  readonly consent: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly summary: Locator;
  readonly nameError: Locator;
  readonly passwordError: Locator;
  readonly signInToConnect: Locator;
  readonly createAccount: Locator;
  readonly tryAgain: Locator;
  readonly connected: Locator;
  readonly pending: Locator;
  readonly ownCode: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.leadName = page.locator('ft-person-summary .ft-person-summary__name');
    this.leadMeta = page.locator('ft-person-summary .ft-person-summary__meta');
    this.consent = page.getByText(/you’re added to .+’s contacts/);
    this.name = page.getByLabel('Full name');
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password', { exact: true });
    this.submit = page.getByRole('button', {
      name: /Create account and connect|Creating your account/,
    });
    this.summary = page.locator('ft-alert').filter({ hasText: /Fix \d+ things? to/ });
    this.nameError = fieldError(page, 'Full name');
    this.passwordError = fieldError(page, 'Password');
    this.signInToConnect = page.getByRole('link', { name: 'Sign in to connect' });
    this.createAccount = page.getByRole('link', { name: 'Create an account' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.connected = page.locator('ft-alert').filter({ hasText: /^.*Connected with / });
    this.pending = page.locator('ft-alert').filter({ hasText: 'Verify your email to finish' });
    this.ownCode = page.locator('ft-alert').filter({ hasText: 'This is your own code' });
  }

  async open(token: string, query = ''): Promise<void> {
    await this.page.goto(`/meet/${token}${query}`);
  }

  sentTo(email: string): Locator {
    return this.page.getByText(email);
  }

  async signUp(name: string, email: string, password: string): Promise<void> {
    await this.name.fill(name);
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
