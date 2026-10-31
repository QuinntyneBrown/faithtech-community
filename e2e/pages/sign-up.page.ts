import { Locator, Page } from '@playwright/test';

import { fieldError } from './sign-in.page';

export class SignUpPage {
  readonly heading: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly summary: Locator;
  readonly nameError: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly checkInbox: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Join FaithTech' });
    this.name = page.getByLabel('Full name');
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password', { exact: true });
    this.submit = page.getByRole('button', { name: /Create account|Creating account/ });
    this.summary = page.locator('ft-alert [role=alert]');
    this.nameError = fieldError(page, 'Full name');
    this.emailError = fieldError(page, 'Email');
    this.passwordError = fieldError(page, 'Password');
    this.checkInbox = page.getByRole('heading', { level: 1, name: 'Check your inbox' });
  }

  /** The heading as another organisation's host shows it (L2-134 AC1). */
  headingFor(shortName: string): Locator {
    return this.page.getByRole('heading', { level: 1, name: `Join ${shortName}` });
  }

  async open(): Promise<void> {
    await this.page.goto('/sign-up');
  }

  async fill(name: string, email: string, password: string): Promise<void> {
    await this.name.fill(name);
    await this.email.fill(email);
    await this.password.fill(password);
  }

  async create(name: string, email: string, password: string): Promise<void> {
    await this.fill(name, email, password);
    await this.submit.click();
  }

  sentTo(email: string): Locator {
    return this.page.getByText(`We sent a link to ${email}`);
  }
}
