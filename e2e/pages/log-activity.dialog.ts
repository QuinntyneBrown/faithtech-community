import { Locator, Page } from '@playwright/test';

/** The Log activity dialog (docs/mocks/dialogs/log-activity). */
export class LogActivityDialog {
  readonly dialog: Locator;
  readonly summary: Locator;
  readonly date: Locator;
  readonly time: Locator;
  readonly nextStep: Locator;
  readonly nextStepDue: Locator;
  /** "Log call", "Log email"... after the chosen type, or "Try again" after a failed save. */
  readonly save: Locator;
  readonly cancel: Locator;
  readonly failed: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: /^Log activity for / });
    this.summary = this.dialog.getByRole('textbox', { name: 'What happened' });
    this.date = this.dialog.getByRole('textbox', { name: 'Date', exact: true });
    this.time = this.dialog.getByRole('textbox', { name: /^Time/ });
    this.nextStep = this.dialog.getByRole('textbox', { name: /^Next step(?! due)/ });
    this.nextStepDue = this.dialog.getByRole('textbox', { name: /^Next step due/ });
    this.save = this.dialog.getByRole('button', {
      name: /^(Log (call|email|meeting|note)|Try again)$/,
    });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.failed = this.dialog.getByRole('alert').filter({ hasText: 'Activity not logged' });
  }

  type(label: 'Call' | 'Email' | 'Meeting' | 'Note'): Locator {
    return this.dialog.getByRole('radio', { name: label });
  }

  /** The inline error under a field, by its message. */
  error(message: string): Locator {
    return this.dialog.getByText(message, { exact: true });
  }

  /** Waits until the dialog has finished animating in, so colours are measured at full opacity. */
  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}
