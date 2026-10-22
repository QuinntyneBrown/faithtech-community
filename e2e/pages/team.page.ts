import { Locator, Page } from '@playwright/test';

/** The team page at /team (docs/mocks/pages/team). */
export class TeamPage {
  readonly heading: Locator;
  readonly inviteSomeone: Locator;
  readonly members: Locator;
  readonly city: Locator;
  readonly skeleton: Locator;
  readonly empty: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  readonly showEveryone: Locator;
  readonly count: Locator;
  readonly showMore: Locator;
  readonly moreFailed: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.inviteSomeone = page.getByRole('link', { name: 'Invite someone' }).first();
    this.members = page.getByRole('list', { name: 'Team' }).getByRole('listitem');
    this.city = page.getByLabel('City');
    this.skeleton = page.getByLabel('Loading team');
    this.empty = page.getByRole('heading', { name: 'No team yet' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load the team' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.showEveryone = page.getByRole('button', { name: 'Show everyone' });
    this.count = page.getByRole('status').filter({ hasText: /^Showing \d+ of \d+ members$/ });
    this.showMore = page.getByRole('button', { name: 'Show more members' });
    this.moreFailed = page.getByRole('alert').filter({ hasText: 'We couldn’t load more members' });
  }

  async open(): Promise<void> {
    await this.page.goto('/team');
  }

  /** Back to the top, as after reading a long list; the sticky top bar otherwise overlaps rows. */
  async scrollToTop(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  roleFilter(label: 'All' | 'Leads' | 'Volunteers'): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  member(name: string): Locator {
    return this.members.filter({ has: this.page.getByRole('link', { name, exact: true }) });
  }

  profileLink(name: string): Locator {
    return this.member(name).getByRole('link', { name, exact: true });
  }

  photo(name: string): Locator {
    return this.member(name).locator('img');
  }

  noResults(text: string): Locator {
    return this.page.getByRole('heading', { name: text });
  }

  async names(): Promise<string[]> {
    return this.page
      .getByRole('list', { name: 'Team' })
      .getByRole('listitem')
      .getByRole('link')
      .allTextContents();
  }
}
