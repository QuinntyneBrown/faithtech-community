import { Locator, Page } from '@playwright/test';

/** Settings (docs/mocks/pages/settings). */
export class SettingsPage {
  readonly heading: Locator;
  readonly appearance: Locator;
  readonly emailCard: Locator;
  /** The "Email me announcements" switch (L2-030 AC2). */
  readonly emailAnnouncements: Locator;
  readonly saved: Locator;
  /** The Account card (L2-052): the sign-in email and a password change. */
  readonly account: Locator;
  readonly email: Locator;
  readonly currentPassword: Locator;
  readonly newPassword: Locator;
  readonly saveSettings: Locator;
  /** The danger zone's button, which opens the Sign out everywhere dialog. */
  readonly signOutEverywhere: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Settings' });
    this.appearance = page.getByRole('region', { name: 'Appearance' });
    this.emailCard = page.getByRole('region', { name: 'Email me when' });
    this.emailAnnouncements = this.emailCard.getByRole('switch', {
      name: 'Email me announcements',
    });
    this.saved = this.emailCard.getByRole('status');
    this.account = page.getByRole('region', { name: 'Account' });
    this.email = this.account.getByLabel('Email');
    this.currentPassword = this.account.getByLabel(/Current password/);
    this.newPassword = this.account.getByLabel(/New password/);
    this.saveSettings = page.getByRole('button', { name: /Save settings|Saving…/ });
    this.signOutEverywhere = page
      .getByRole('region', { name: 'Sign out everywhere' })
      .getByRole('button', { name: 'Sign out everywhere' });
  }

  async open(): Promise<void> {
    await this.page.goto('/settings');
  }

  /** The alert above the cards once the Account card saved, naming what changed. */
  accountSaved(text: string): Locator {
    return this.page
      .getByRole('status')
      .filter({ hasText: 'Settings saved' })
      .filter({ hasText: text });
  }

  /** The error summary above the cards, "Fix 1 thing to save". */
  errorSummary(): Locator {
    return this.page.getByRole('alert').filter({ hasText: /Fix \d+ things? to save/ });
  }

  /** The error under one Account field: "Email", "Current password" or "New password". */
  fieldError(label: string): Locator {
    return this.account
      .locator('ft-form-field')
      .filter({ hasText: label })
      .locator('ft-inline-message');
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
