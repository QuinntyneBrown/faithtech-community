import { Locator, Page } from '@playwright/test';

/** The shared Add role / Remove role dialog (docs/mocks/dialogs/add-role, remove-role). */
export class RoleDialog {
  readonly dialog: Locator;
  readonly options: Locator;
  readonly caption: Locator;
  readonly confirm: Locator;
  readonly cancel: Locator;
  readonly choiceError: Locator;
  readonly refusal: Locator;

  constructor(page: Page, heading: string | RegExp) {
    this.dialog = page.getByRole('dialog', { name: heading });
    this.options = this.dialog.getByRole('radio');
    this.caption = this.dialog.getByText('can only be granted by a System Admin');
    this.confirm = this.dialog.getByRole('button', { name: /^(Add|Adding|Remove|Removing) role/ });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.choiceError = this.dialog.getByText('Choose a role to add.');
    this.refusal = this.dialog.locator('ft-alert');
  }

  option(label: string): Locator {
    return this.dialog.getByRole('radio', { name: new RegExp(`^${label}`) });
  }
}
