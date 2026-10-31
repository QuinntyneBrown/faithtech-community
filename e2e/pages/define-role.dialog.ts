import { Locator, Page } from '@playwright/test';

/** Define a role and Edit {role} (docs/mocks/dialogs/define-role). */
export class DefineRoleDialog {
  readonly dialog: Locator;
  readonly name: Locator;
  readonly description: Locator;
  readonly capabilities: Locator;
  readonly showOnTeam: Locator;
  readonly oversight: Locator;
  readonly save: Locator;
  readonly cancel: Locator;
  readonly refusal: Locator;

  constructor(page: Page, title: string | RegExp = /^(Define a role|Edit .+)$/) {
    this.dialog = page.getByRole('dialog', { name: title });
    this.name = this.dialog.getByLabel('Name', { exact: true });
    this.description = this.dialog.getByRole('textbox', { name: /^Description/ });
    this.capabilities = this.dialog.getByRole('group', { name: 'Capabilities' });
    this.showOnTeam = this.dialog.getByRole('switch', { name: 'Show on the team list' });
    this.oversight = this.dialog.getByRole('switch', { name: /^Oversight role/ });
    this.save = this.dialog.getByRole('button', {
      name: /^(Define role|Save changes|Saving…|Try again)$/,
    });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.refusal = this.dialog.getByRole('alert');
  }

  /** The checkbox of the capability labelled `label`, such as "Manage events". */
  capability(label: string): Locator {
    return this.capabilities.getByRole('checkbox', { name: new RegExp(`^${label}\\b`) });
  }

  /** A field's inline error, by the text it shows. */
  error(text: string): Locator {
    return this.dialog.getByText(text);
  }
}
