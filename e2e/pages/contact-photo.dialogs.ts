import { Locator, Page } from '@playwright/test';

/** Add photos of a contact (docs/mocks/dialogs/add-contact-photo). */
export class AddContactPhotoDialog {
  readonly dialog: Locator;
  readonly choose: Locator;
  readonly add: Locator;
  readonly cancel: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: /^Add photos of / });
    this.choose = this.dialog.getByRole('button', { name: 'Add photos' }).first();
    this.add = this.dialog.locator('ft-dialog footer, .ft-dialog__footer').getByRole('button', {
      name: /^(Add photos|Adding…)$/,
    });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
  }

  /** Chooses files through the dialog's picker, as a lead would in the file picker. */
  async choosePhotos(files: { name: string; mimeType: string; buffer: Buffer }[]): Promise<void> {
    const chooser = this.page.waitForEvent('filechooser');
    await this.choose.click();
    await (await chooser).setFiles(files);
  }

  description(index: number): Locator {
    return this.dialog.getByLabel(`Photo ${index + 1} description`);
  }

  error(text: string): Locator {
    return this.dialog.getByText(text, { exact: true });
  }
}

/** Edit a contact photo's description (docs/mocks/dialogs/edit-photo-description). */
export class EditPhotoDescriptionDialog {
  readonly dialog: Locator;
  readonly description: Locator;
  readonly save: Locator;
  readonly cancel: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Edit photo description' });
    this.description = this.dialog.getByRole('textbox', { name: /^Description/ });
    this.save = this.dialog.getByRole('button', { name: /^(Save description|Saving…)$/ });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
  }

  error(text: string): Locator {
    return this.dialog.getByText(text, { exact: true });
  }
}

/** Confirm deleting a contact photo (docs/mocks/dialogs/delete-contact-photo). */
export class DeleteContactPhotoDialog {
  readonly dialog: Locator;
  readonly photo: Locator;
  readonly confirm: Locator;
  readonly cancel: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Delete this photo?' });
    this.photo = this.dialog.getByRole('img');
    this.confirm = this.dialog.getByRole('button', { name: /^(Delete photo|Deleting photo…)$/ });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
  }
}
