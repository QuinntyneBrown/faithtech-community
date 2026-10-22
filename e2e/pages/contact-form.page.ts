import { Locator, Page } from '@playwright/test';

/** Add or edit a contact at /contacts/new and /contacts/:id/edit (docs/mocks/pages/contact-form). */
export class ContactFormPage {
  readonly heading: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly phone: Locator;
  readonly organisation: Locator;
  readonly city: Locator;
  readonly firstNote: Locator;
  readonly save: Locator;
  readonly saveAndLink: Locator;
  readonly summary: Locator;
  readonly memberAlert: Locator;
  readonly photosGroup: Locator;
  readonly addPhotos: Locator;
  readonly photoItems: Locator;
  readonly photoLimit: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.name = page.getByRole('textbox', { name: 'Name', exact: true });
    this.email = page.getByRole('textbox', { name: /^Email/ });
    this.phone = page.getByRole('textbox', { name: /^Phone/ });
    this.organisation = page.getByRole('textbox', { name: /^Organisation/ });
    this.city = page.getByRole('textbox', { name: /^City/ });
    this.firstNote = page.getByRole('textbox', { name: /^First note/ });
    this.save = page.getByRole('button', { name: 'Save contact' });
    this.saveAndLink = page.getByRole('button', { name: 'Save and link' });
    this.summary = page.locator('ft-error-summary');
    this.memberAlert = page.locator('ft-alert', { hasText: 'is already a member' });
    this.photosGroup = page.getByRole('group', { name: 'Photos' });
    this.addPhotos = this.photosGroup.getByRole('button', { name: 'Add photos' });
    this.photoItems = this.photosGroup.getByRole('listitem');
    this.photoLimit = this.photosGroup.getByText(
      'That’s 10 photos, the most a contact can have. Remove one to add another.',
    );
  }

  async openNew(): Promise<void> {
    await this.page.goto('/contacts/new');
  }

  /** Chooses files through Add photos, as a lead would in the file picker. */
  async choosePhotos(files: { name: string; mimeType: string; buffer: Buffer }[]): Promise<void> {
    const chooser = this.page.waitForEvent('filechooser');
    await this.addPhotos.click();
    await (await chooser).setFiles(files);
  }

  description(index: number): Locator {
    return this.page.getByLabel(`Photo ${index + 1} description`);
  }

  feature(index: number): Locator {
    return this.page.getByRole('button', { name: `Feature photo ${index + 1}` });
  }

  /** The list item of the photo marked featured. */
  featuredPhoto(): Locator {
    return this.photoItems.filter({ has: this.page.getByText('Featured', { exact: true }) });
  }

  /** A note in the photos group, such as a file the browser refused. */
  note(text: string): Locator {
    return this.photosGroup.getByText(text);
  }

  error(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }
}
