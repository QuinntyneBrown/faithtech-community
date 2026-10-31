import { Locator, Page } from '@playwright/test';

import { fieldError } from './sign-in.page';

/**
 * Edit your own profile at /people/me/edit, or, as a System Admin, another member's at
 * /people/:id/edit (docs/mocks/pages/edit-profile).
 */
export class EditProfilePage {
  readonly heading: Locator;
  readonly name: Locator;
  /** The home chapter picker, labelled with the organisation's chapter label. */
  readonly chapter: Locator;
  readonly bio: Locator;
  readonly save: Locator;
  readonly cancel: Locator;
  /** The buttons and links at the end of the form, in DOM (and tab) order. */
  readonly actions: Locator;
  readonly summary: Locator;
  readonly nameError: Locator;
  readonly bioError: Locator;
  /** The characters-left counter under the bio. */
  readonly bioCount: Locator;
  readonly loading: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  readonly savedToast: Locator;
  readonly failedAlert: Locator;
  readonly photosGroup: Locator;
  readonly addPhotos: Locator;
  readonly photoItems: Locator;
  readonly photoLimit: Locator;
  /** The page's h1, whatever it says. */
  readonly title: Locator;
  readonly adminNote: Locator;
  readonly breadcrumb: Locator;
  readonly forbidden: Locator;
  readonly backToProfile: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Edit profile' });
    this.name = page.getByLabel('Name', { exact: true });
    this.chapter = page.getByRole('combobox', { name: /^Home / });
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
    this.bioCount = page
      .locator('ft-form-field')
      .filter({ has: page.getByText('Up to 400 characters.') })
      .locator('.field__count');
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
    this.title = page.getByRole('heading', { level: 1 });
    this.adminNote = page.getByText(
      'You’re editing as System Admin. Every change is recorded in the audit log.',
    );
    this.breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    this.forbidden = page.getByRole('heading', { name: 'You can only edit your own profile' });
    this.backToProfile = page.getByRole('link', { name: 'Back to profile' });
  }

  async open(id = 'me'): Promise<void> {
    await this.page.goto(`/people/${id}/edit`);
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

  /** The photo's thumbnail image. */
  thumbnail(index: number): Locator {
    return this.photo(index).getByRole('img');
  }

  /** The "Featured" badge, on the featured photo only. */
  featuredBadge(): Locator {
    return this.photosGroup.getByText('Featured', { exact: true });
  }

  /** The list item of the featured photo. */
  featuredPhoto(): Locator {
    return this.photoItems.filter({ has: this.page.getByText('Featured', { exact: true }) });
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

  /** The picker's options as the member reads them. */
  async chapterOptions(): Promise<string[]> {
    return (await this.chapter.locator('option').allTextContents()).map((o) => o.trim());
  }

  /** Types the name and bio; picks the chapter by its name. */
  async fill(details: { name?: string; chapter?: string; bio?: string }): Promise<void> {
    if (details.name !== undefined) await this.name.fill(details.name);
    if (details.chapter !== undefined) await this.chapter.selectOption({ label: details.chapter });
    if (details.bio !== undefined) await this.bio.fill(details.bio);
  }
}
