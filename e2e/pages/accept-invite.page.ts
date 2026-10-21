import { Locator, Page } from '@playwright/test';

/** The invite link at /accept-invite/:token (docs/mocks/pages/accept-invite). */
export class AcceptInvitePage {
  readonly heading: Locator;
  readonly invitation: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly acceptAndJoin: Locator;
  readonly acceptInvite: Locator;
  readonly signInToAccept: Locator;
  readonly createAccount: Locator;
  readonly errorSummary: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.invitation = page.getByText(/invited you to join/);
    this.name = page.getByLabel('Full name');
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Create a password');
    this.acceptAndJoin = page.getByRole('button', { name: /^Accept and join/ });
    this.acceptInvite = page.getByRole('button', { name: 'Accept invite' });
    this.signInToAccept = page.getByRole('button', { name: 'Sign in to accept' });
    this.createAccount = page.getByRole('link', { name: 'Create an account' });
    this.errorSummary = page.locator('ft-alert').filter({ hasText: /Fix \d+ things? to accept/ });
  }

  async open(token: string): Promise<void> {
    await this.page.goto(`/accept-invite/${token}`);
  }
}
