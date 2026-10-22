import { Locator, Page } from '@playwright/test';

/** The Restore partner confirmation (docs/mocks/dialogs/restore-partner). */
export class RestorePartnerDialog {
  readonly dialog: Locator;
  readonly confirm: Locator;
  readonly reload: Locator;
  /** "Partner not restored". */
  readonly failed: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: /^Restore / });
    this.confirm = this.dialog.getByRole('button', { name: 'Restore partner' });
    this.reload = this.dialog.getByRole('button', { name: 'Reload and try again' });
    this.failed = this.dialog.getByRole('alert').filter({ hasText: 'Partner not restored' });
  }

  /** Waits until the dialog has finished animating in, so colours are measured at full opacity. */
  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}
