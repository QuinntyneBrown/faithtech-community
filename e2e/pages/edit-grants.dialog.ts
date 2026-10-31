import { Locator, Page } from '@playwright/test';

/** Who may grant: {role} (docs/mocks/dialogs/edit-grants). */
export class EditGrantsDialog {
  readonly dialog: Locator;
  readonly roles: Locator;
  readonly inactive: Locator;
  readonly save: Locator;
  readonly cancel: Locator;

  constructor(page: Page, grantor: string) {
    this.dialog = page.getByRole('dialog', { name: `Who may grant: ${grantor}` });
    this.roles = this.dialog.getByRole('group', {
      name: `Holders of ${grantor} may add and remove:`,
    });
    this.inactive = this.dialog.getByText(
      'This role can’t assign roles until it has the Assign roles capability.',
    );
    this.save = this.dialog.getByRole('button', { name: /^(Save rules|Saving…|Try again)$/ });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
  }

  /** The checkbox of the role named `name`. */
  role(name: string): Locator {
    return this.roles.getByRole('checkbox', { name: new RegExp(`^${name}\\b`) });
  }

  /** The checklist's error, by the text it shows. */
  error(text: string): Locator {
    return this.dialog.getByText(text);
  }
}
