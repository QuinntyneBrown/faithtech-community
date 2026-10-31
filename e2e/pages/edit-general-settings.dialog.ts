import { Locator, Page } from '@playwright/test';

/** Edit general settings (docs/mocks/dialogs/edit-general-settings). */
export class EditGeneralSettingsDialog {
  readonly dialog: Locator;
  readonly name: Locator;
  readonly shortName: Locator;
  readonly save: Locator;
  readonly cancel: Locator;
  readonly nameError: Locator;
  readonly shortNameError: Locator;
  readonly failed: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Edit general settings' });
    this.name = this.dialog.getByLabel('Name', { exact: true });
    this.shortName = this.dialog.getByLabel('Short name', { exact: true });
    this.save = this.dialog.getByRole('button', { name: /^(Save|Saving…|Try again)$/ });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.nameError = this.dialog.getByText('Enter a name.');
    this.shortNameError = this.dialog.getByText('Enter a short name.');
    this.failed = this.dialog.getByText('Settings not saved');
  }
}
