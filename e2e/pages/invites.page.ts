import { Locator, Page } from '@playwright/test';

/** The invites page at /invites (docs/mocks/pages/invites). */
export class InvitesPage {
  readonly heading: Locator;
  readonly inviteSomeone: Locator;
  readonly items: Locator;
  readonly empty: Locator;
  readonly loadError: Locator;
  readonly toast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.inviteSomeone = page.getByRole('button', { name: 'Invite someone' }).first();
    this.items = page.getByRole('list', { name: 'Invites' }).getByRole('listitem');
    this.empty = page.getByRole('heading', { name: 'No invites sent' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load invites' });
    this.toast = page.locator('ft-toast');
  }

  async open(): Promise<void> {
    await this.page.goto('/invites');
  }

  item(email: string): Locator {
    return this.items.filter({ hasText: email });
  }

  resend(email: string): Locator {
    return this.page.getByRole('button', { name: `Resend invite to ${email}` });
  }
}
