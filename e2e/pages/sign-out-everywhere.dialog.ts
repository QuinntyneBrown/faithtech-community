import { Locator, Page } from '@playwright/test';

/** Sign out everywhere? (docs/mocks/dialogs/sign-out-everywhere). */
export class SignOutEverywhereDialog {
  readonly dialog: Locator;
  readonly description: Locator;
  readonly cancel: Locator;
  readonly confirm: Locator;
  readonly failed: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Sign out everywhere?' });
    this.description = this.dialog.getByText(
      'This ends every session on every device, including this one.',
    );
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.confirm = this.dialog.getByRole('button', { name: /Sign out everywhere|Signing out…/ });
    this.failed = this.dialog.locator('ft-alert').filter({ hasText: 'Devices not signed out' });
  }
}
