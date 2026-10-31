import { Locator, Page } from '@playwright/test';

/** The Organisation section's General tab at /organisation (docs/mocks/pages/organisation-general). */
export class OrganisationGeneralPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly tabs: Locator;
  readonly edit: Locator;
  readonly readOnly: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  readonly savedToast: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page
      .getByRole('main')
      .locator('ft-page-header .subtitle, ft-page-header p')
      .first();
    this.tabs = page.getByRole('navigation', { name: 'Organisation settings' }).getByRole('link');
    this.edit = page.getByRole('button', { name: 'Edit general settings' });
    this.readOnly = page.getByText('You can view these settings but not change them.');
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load these settings' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.savedToast = page.locator('ft-toast').filter({ hasText: 'Settings saved' });
  }

  async open(): Promise<void> {
    await this.page.goto('/organisation');
  }

  /** The value shown beside a label in the General list, such as Name or Short name. */
  value(label: string): Locator {
    return this.page
      .getByRole('main')
      .locator('ft-description-list-item')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator('dd');
  }
}
