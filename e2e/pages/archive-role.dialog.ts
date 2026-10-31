import { Locator, Page } from '@playwright/test';

/** Archive {role}? (docs/mocks/dialogs/archive-role). */
export class ArchiveRoleDialog {
  readonly dialog: Locator;
  readonly confirm: Locator;
  readonly close: Locator;
  readonly refusal: Locator;
  readonly buttons: Locator;

  constructor(page: Page, role: string) {
    this.dialog = page.getByRole('dialog', { name: `Archive ${role}?` });
    this.confirm = this.dialog.getByRole('button', {
      name: /^(Archive role|Archiving…|Try again)$/,
    });
    // The footer's Close, not the header's close icon.
    this.close = this.dialog
      .locator('ft-button')
      .getByRole('button', { name: 'Close', exact: true });
    this.refusal = this.dialog.getByRole('alert');
    this.buttons = this.dialog.locator('ft-button');
  }
}
