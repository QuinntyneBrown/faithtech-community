import { Locator, Page } from '@playwright/test';

/** Edit general settings (docs/mocks/dialogs/edit-general-settings). */
export class EditGeneralSettingsDialog {
  readonly dialog: Locator;
  readonly name: Locator;
  readonly shortName: Locator;
  readonly chapters: Locator;
  readonly singular: Locator;
  readonly plural: Locator;
  readonly givingLink: Locator;
  readonly givingText: Locator;
  readonly save: Locator;
  readonly cancel: Locator;
  readonly nameError: Locator;
  readonly shortNameError: Locator;
  readonly failed: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Edit general settings' });
    this.name = this.dialog.getByLabel('Name', { exact: true });
    this.shortName = this.dialog.getByLabel('Short name', { exact: true });
    this.chapters = this.dialog.getByRole('switch', { name: /^This organisation has chapters/ });
    this.singular = this.dialog.getByLabel('Singular label', { exact: true });
    this.plural = this.dialog.getByLabel('Plural label', { exact: true });
    this.givingLink = this.dialog.getByRole('textbox', { name: /^Giving link/ });
    this.givingText = this.dialog.getByRole('textbox', { name: /^Giving text/ });
    this.save = this.dialog.getByRole('button', { name: /^(Save settings|Saving…|Try again)$/ });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.nameError = this.dialog.getByText('Enter a name.');
    this.shortNameError = this.dialog.getByText('Enter a short name.');
    this.failed = this.dialog.getByText('Settings not saved');
  }

  /** A field's inline error, by the text it shows. */
  error(text: string): Locator {
    return this.dialog.getByText(text).first();
  }
}
