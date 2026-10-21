import { Locator, Page } from '@playwright/test';

/** The Link contact to profile dialog (docs/mocks/dialogs/link-contact). */
export class LinkContactDialog {
  readonly dialog: Locator;
  readonly keepNotes: Locator;
  readonly discardNotes: Locator;
  readonly link: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: /^Link to / });
    this.keepNotes = this.dialog.getByRole('radio', { name: /Keep my notes private to me/ });
    this.discardNotes = this.dialog.getByRole('radio', { name: /Discard my notes/ });
    this.link = this.dialog.getByRole('button', { name: 'Link profile' });
  }

  /** Waits until the dialog has finished animating in, so colours are measured at full opacity. */
  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}
