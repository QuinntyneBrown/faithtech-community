import { Locator, Page } from '@playwright/test';

/** The Delete contact permanently dialog (docs/mocks/dialogs/delete-contact). */
export class DeleteContactDialog {
  readonly dialog: Locator;
  readonly confirmation: Locator;
  readonly delete: Locator;
  readonly mismatch: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: /for good\?$/ });
    this.confirmation = this.dialog.getByRole('textbox', { name: 'Type DELETE to confirm' });
    this.delete = this.dialog.getByRole('button', { name: 'Delete permanently' });
    this.mismatch = this.dialog.getByText('Type DELETE in capitals to confirm.');
  }

  /** Waits until the dialog has finished animating in, so colours are measured at full opacity. */
  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}
