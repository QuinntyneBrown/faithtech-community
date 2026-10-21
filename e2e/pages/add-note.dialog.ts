import { Locator, Page } from '@playwright/test';

/** The Add note dialog (docs/mocks/dialogs/add-note). */
export class AddNoteDialog {
  readonly dialog: Locator;
  readonly note: Locator;
  readonly add: Locator;
  readonly emptyError: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: /^Add a note about/ });
    this.note = this.dialog.getByRole('textbox', { name: 'Note' });
    this.add = this.dialog.getByRole('button', { name: 'Add note' });
    this.emptyError = this.dialog.getByText('Write a note to save.');
  }

  /** Waits until the dialog has finished animating in, so colours are measured at full opacity. */
  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}
