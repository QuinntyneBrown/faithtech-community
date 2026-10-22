import { Locator, Page } from '@playwright/test';

/** The Cancel {event}? dialog (docs/mocks/dialogs/cancel-event). */
export class CancelEventDialog {
  readonly dialog: Locator;
  readonly message: Locator;
  readonly keep: Locator;
  readonly confirm: Locator;
  readonly failed: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: /^Cancel .+\?$/ });
    this.message = this.dialog.getByLabel('Message to attendees');
    this.keep = this.dialog.getByRole('button', { name: 'Keep event' });
    this.confirm = this.dialog.getByRole('button', { name: 'Cancel event' });
    this.failed = this.dialog.getByRole('alert').filter({ hasText: 'Event not cancelled' });
  }

  /** The inline error under the message, read through its aria-describedby. */
  error(): Promise<string> {
    return this.message.evaluate((el) =>
      (el.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => (id ? (document.getElementById(id)?.textContent ?? '') : ''))
        .join(' ')
        .trim(),
    );
  }
}
