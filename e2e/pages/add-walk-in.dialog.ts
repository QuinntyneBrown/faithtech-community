import { Locator, Page } from '@playwright/test';

/** The Add a walk-in dialog on the check-in page (docs/mocks/dialogs/check-in-walk-in). */
export class AddWalkInDialog {
  readonly dialog: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly checkInNow: Locator;
  /** "Add and check in", "Add walk-in", "Adding…" while saving, or "Try again" after a failure. */
  readonly save: Locator;
  readonly cancel: Locator;
  readonly failed: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Add a walk-in' });
    this.name = this.dialog.getByRole('textbox', { name: 'Name' });
    this.email = this.dialog.getByRole('textbox', { name: /^Email/ });
    this.checkInNow = this.dialog.getByRole('switch', { name: 'Check them in now' });
    this.save = this.dialog.getByRole('button', {
      name: /^(Add and check in|Add walk-in|Adding…|Try again)$/,
    });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.failed = this.dialog.getByRole('alert').filter({ hasText: 'Walk-in not added' });
  }

  /** The inline error under a field, by its message. */
  error(message: string): Locator {
    return this.dialog.getByText(message, { exact: true });
  }

  /** Waits until the dialog has finished animating in, so colours are measured at full opacity. */
  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}
