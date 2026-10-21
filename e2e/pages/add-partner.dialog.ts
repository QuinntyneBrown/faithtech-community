import { Locator, Page } from '@playwright/test';

/** The Add partner dialog (docs/mocks/dialogs/add-partner). */
export class AddPartnerDialog {
  readonly dialog: Locator;
  readonly name: Locator;
  readonly website: Locator;
  readonly stage: Locator;
  readonly contact: Locator;
  readonly email: Locator;
  readonly offering: Locator;
  readonly owner: Locator;
  readonly add: Locator;
  readonly nameError: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Add a partner' });
    this.name = this.dialog.getByRole('textbox', { name: 'Organisation' });
    this.website = this.dialog.getByRole('textbox', { name: /^Website/ });
    this.stage = this.dialog.getByRole('combobox', { name: 'Stage' });
    this.contact = this.dialog.getByRole('textbox', { name: /^Main contact/ });
    this.email = this.dialog.getByRole('textbox', { name: /^Email/ });
    this.offering = this.dialog.getByRole('textbox', { name: /^What they could offer/ });
    this.owner = this.dialog.getByRole('combobox', { name: /^Owner/ });
    this.add = this.dialog.getByRole('button', { name: 'Add partner' });
    this.nameError = this.dialog.getByText('Enter the organisation’s name.');
  }

  /** Waits until the dialog has finished animating in, so colours are measured at full opacity. */
  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}
