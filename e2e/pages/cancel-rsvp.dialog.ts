import { Locator, Page } from '@playwright/test';

/** The Cancel your RSVP? dialog (docs/mocks/dialogs/cancel-rsvp). */
export class CancelRsvpDialog {
  readonly dialog: Locator;
  readonly keep: Locator;
  readonly confirm: Locator;
  readonly failed: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Cancel your RSVP?' });
    this.keep = this.dialog.getByRole('button', { name: 'Keep my RSVP' });
    this.confirm = this.dialog.getByRole('button', { name: 'Cancel my RSVP' });
    this.failed = this.dialog.getByRole('alert').filter({ hasText: 'RSVP not cancelled' });
  }
}
