import { Locator, Page } from '@playwright/test';

/** Settings (docs/mocks/pages/settings). */
export class SettingsPage {
  readonly heading: Locator;
  readonly appearance: Locator;
  /** "Email me announcements" under "Email me when" (L2-030 AC2). */
  readonly announcementEmails: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Settings' });
    this.appearance = page.getByRole('region', { name: 'Appearance' });
    this.announcementEmails = page
      .getByRole('region', { name: 'Email me when' })
      .getByRole('switch', { name: 'Email me announcements' });
  }

  /** A theme option under Appearance: "Light", "Dark" or "Match my device". */
  theme(name: string): Locator {
    // The option's description follows its label in the accessible name.
    return this.appearance.getByRole('radio', { name: new RegExp(`^${name}\\b`) });
  }

  async chooseTheme(name: string): Promise<void> {
    await this.theme(name).check();
  }

  /** The forced theme on <html>, or null when the page follows the device. */
  forcedTheme(): Promise<string | null> {
    return this.page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  }
}
