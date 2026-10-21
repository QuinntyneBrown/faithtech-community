import { Locator, Page } from '@playwright/test';

/** The Archive contact confirmation (docs/mocks/dialogs/archive-contact). */
export class ArchiveContactDialog {
  readonly dialog: Locator;
  readonly archive: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: /^Archive / });
    this.archive = this.dialog.getByRole('button', { name: 'Archive', exact: true });
  }

  /** Waits until the dialog has finished animating in, so colours are measured at full opacity. */
  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}
