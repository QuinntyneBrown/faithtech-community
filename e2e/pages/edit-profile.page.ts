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
  /** The buttons and links at the end of the form, in DOM (and tab) order. */
  readonly actions: Locator;
  readonly summary: Locator;
  readonly nameError: Locator;
  readonly bioError: Locator;
  readonly loading: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  readonly savedToast: Locator;
  readonly failedAlert: Locator;
  readonly photosGroup: Locator;
  readonly addPhotos: Locator;
  readonly photoItems: Locator;
  readonly photoLimit: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Edit profile' });
    this.name = page.getByLabel('Name', { exact: true });
    this.homeCity = page.getByLabel('Home city');
    this.bio = page.getByRole('textbox', { name: /Bio/ });
    this.save = page.getByRole('button', { name: /Save profile|Saving/ });
    this.cancel = page.getByRole('link', { name: 'Cancel' });
    this.actions = page.locator('ft-form-actions').locator('a, button');
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
    this.photosGroup = page.getByRole('group', { name: 'Photos' });
    this.addPhotos = this.photosGroup.getByRole('button', { name: 'Add photos' });
    this.photoItems = this.photosGroup.getByRole('listitem');
    this.photoLimit = this.photosGroup.getByText(
      'That’s 10 photos, the most a profile can have. Remove one to add another.',
    );
  }

  async open(): Promise<void> {
    await this.page.goto('/people/me/edit');
  }

  /** Chooses files through Add photos, as a member would in the file picker. */
  async choosePhotos(files: { name: string; mimeType: string; buffer: Buffer }[]): Promise<void> {
    const chooser = this.page.waitForEvent('filechooser');
    await this.addPhotos.click();
    await (await chooser).setFiles(files);
  }

  photo(index: number): Locator {
    return this.photoItems.nth(index);
  }

  description(index: number): Locator {
    return this.page.getByLabel(`Photo ${index + 1} description`);
  }

  feature(index: number): Locator {
    return this.page.getByRole('button', { name: `Feature photo ${index + 1}` });
  }

  remove(index: number): Locator {
    return this.page.getByRole('button', { name: `Remove photo ${index + 1}` });
  }

  /** A note in the photos group, such as a file the browser refused. */
  note(text: string): Locator {
    return this.photosGroup.getByText(text);
  }

  async fill(details: { name?: string; homeCity?: string; bio?: string }): Promise<void> {
    if (details.name !== undefined) await this.name.fill(details.name);
    if (details.homeCity !== undefined) await this.homeCity.fill(details.homeCity);
    if (details.bio !== undefined) await this.bio.fill(details.bio);
  }
}
