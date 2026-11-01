import { Locator, Page } from '@playwright/test';

/** The Unpublish the hub? dialog (docs/mocks/dialogs/unpublish-hub). */
export class UnpublishHubDialog {
  readonly dialog: Locator;
  readonly cancel: Locator;
  readonly confirm: Locator;
  readonly failed: Locator;
  readonly tryAgain: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Unpublish the hub?' });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel', exact: true });
    this.confirm = this.dialog.getByRole('button', { name: /^(Unpublish|Unpublishing…)$/ });
    this.failed = this.dialog
      .getByRole('alert')
      .filter({ hasText: 'We couldn’t unpublish the hub' });
    this.tryAgain = this.dialog.getByRole('button', { name: 'Try again' });
  }
}
