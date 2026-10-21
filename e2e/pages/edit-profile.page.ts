import { Locator, Page } from '@playwright/test';

import { fieldError } from './sign-in.page';

/** Edit your own profile at /people/me/edit (docs/mocks/pages/edit-profile). */
export class EditProfilePage {
  readonly heading: Locator;
  readonly name: Locator;
  readonly homeCity: Locator;
  readonly bio: Locator;
  readonly save: Locator;
  readonly cancel: Locator;
  readonly summary: Locator;
  readonly nameError: Locator;
  readonly bioError: Locator;
  readonly loading: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  readonly savedToast: Locator;
  readonly failedAlert: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Edit profile' });
    this.name = page.getByLabel('Name', { exact: true });
    this.homeCity = page.getByLabel('Home city');
    this.bio = page.getByRole('textbox', { name: /Bio/ });
    this.save = page.getByRole('button', { name: /Save profile|Saving/ });
    this.cancel = page.getByRole('link', { name: 'Cancel' });
    this.summary = page.locator('ft-error-summary [role=alert]');
    this.nameError = fieldError(page, 'Name');
    this.bioError = page
      .locator('ft-form-field')
      .filter({ has: page.getByText('Up to 400 characters.') })
      .locator('ft-inline-message');
    this.loading = page.locator('[aria-busy="true"][aria-label="Loading your profile"]');
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load your profile' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.savedToast = page.locator('ft-toast').filter({ hasText: 'Profile saved' });
    this.failedAlert = page
      .locator('ft-alert')
      .filter({ hasText: 'We couldn’t save your profile' });
  }

  async open(): Promise<void> {
    await this.page.goto('/people/me/edit');
  }

  async fill(details: { name?: string; homeCity?: string; bio?: string }): Promise<void> {
    if (details.name !== undefined) await this.name.fill(details.name);
    if (details.homeCity !== undefined) await this.homeCity.fill(details.homeCity);
    if (details.bio !== undefined) await this.bio.fill(details.bio);
  }
}
