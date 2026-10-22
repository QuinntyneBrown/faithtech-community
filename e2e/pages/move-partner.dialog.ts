import { Locator, Page } from '@playwright/test';

/** The Move partner stage dialog (docs/mocks/dialogs/move-partner). */
export class MovePartnerDialog {
  readonly dialog: Locator;
  readonly note: Locator;
  readonly confirm: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: /^Move / });
    this.note = this.dialog.getByRole('textbox', { name: /^Note for the history/ });
    this.confirm = this.dialog.getByRole('button', { name: /^Move to / });
  }

  stage(label: string): Locator {
    return this.dialog.getByRole('radio', { name: new RegExp(`^${label}`) });
  }

  /** Waits until the dialog has finished animating in, so colours are measured at full opacity. */
  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}
