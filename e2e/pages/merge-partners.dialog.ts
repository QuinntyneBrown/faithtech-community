import { Locator, Page } from '@playwright/test';

/** The Merge partners dialog (docs/mocks/dialogs/merge-partners). */
export class MergePartnersDialog {
  readonly dialog: Locator;
  /** One radio group per field whose values differ. */
  readonly fields: Locator;
  /** The caption naming the fields that are the same on both. */
  readonly sameFields: Locator;
  readonly confirm: Locator;
  readonly reload: Locator;
  readonly cancel: Locator;
  /** "Partners not merged". */
  readonly failed: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: /^Merge / });
    this.fields = this.dialog.getByRole('radiogroup');
    this.sameFields = this.dialog.getByText(/are the same on both|is the same on both/);
    this.confirm = this.dialog.getByRole('button', { name: 'Merge partners' });
    this.reload = this.dialog.getByRole('button', { name: 'Reload and try again' });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.failed = this.dialog.getByRole('alert').filter({ hasText: 'Partners not merged' });
  }

  field(label: string): Locator {
    return this.dialog.getByRole('radiogroup', { name: label });
  }

  /** The radio for one record's value of a field: "keep" is the current record, "other" the duplicate. */
  value(label: string, which: 'keep' | 'other'): Locator {
    return this.field(label)
      .getByRole('radio')
      .nth(which === 'keep' ? 0 : 1);
  }

  /** Waits until the dialog has finished animating in, so colours are measured at full opacity. */
  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}
