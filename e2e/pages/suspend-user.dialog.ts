import { Locator, Page } from '@playwright/test';

/** The Suspend user confirmation (docs/mocks/dialogs/suspend-user). */
export class SuspendUserDialog {
  readonly dialog: Locator;
  readonly reason: Locator;
  readonly confirm: Locator;
  readonly cancel: Locator;
  readonly reasonError: Locator;

  constructor(page: Page, name: string) {
    this.dialog = page.getByRole('dialog', { name: `Suspend ${name}?` });
    this.reason = this.dialog.getByLabel('Reason (recorded in the audit log)');
    this.confirm = this.dialog.getByRole('button', { name: /^Suspend/ });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.reasonError = this.dialog.getByText('Give a reason so other admins understand.');
  }
}
