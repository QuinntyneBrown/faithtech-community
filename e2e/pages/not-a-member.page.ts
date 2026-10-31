import { Locator, Page } from '@playwright/test';

/** The page a signed-in account with no profile in the host's organisation sees (docs/mocks/pages/not-a-member). */
export class NotAMemberPage {
  readonly lead: Locator;
  readonly yourOrganisations: Locator;
  readonly signOut: Locator;

  constructor(private readonly page: Page) {
    this.lead = page.getByText(/^You’re signed in as /);
    this.yourOrganisations = page.getByRole('heading', { level: 2, name: 'Your organisations' });
    this.signOut = page.getByRole('button', { name: 'Sign out' });
  }

  heading(organisation: string): Locator {
    return this.page.getByRole('heading', {
      level: 1,
      name: `You’re not a member of ${organisation}`,
    });
  }

  /** The link to another organisation the account belongs to. */
  membership(name: string): Locator {
    return this.page.getByRole('link', { name });
  }

  path(): string {
    return new URL(this.page.url()).pathname;
  }

  async visit(path: string): Promise<void> {
    await this.page.goto(path);
  }
}
