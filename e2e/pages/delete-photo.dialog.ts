import { Locator, Page } from '@playwright/test';

/** The Delete photo confirmation (docs/mocks/dialogs/delete-photo). */
export class DeletePhotoDialog {
  readonly dialog: Locator;
  readonly description: Locator;
  readonly photo: Locator;
  readonly cancel: Locator;
  readonly confirm: Locator;
  readonly failure: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Delete this photo?' });
    this.description = this.dialog.locator('.dialog__description');
    this.photo = this.dialog.getByRole('img');
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.confirm = this.dialog.getByRole('button', { name: /Delete photo/ });
    this.failure = this.dialog.locator('ft-alert').filter({ hasText: 'That didn’t work' });
  }
}
