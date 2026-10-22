import { Locator, Page } from '@playwright/test';

/** The New workspace dialog (docs/mocks/dialogs/create-workspace). */
export class CreateWorkspaceDialog {
  readonly dialog: Locator;
  readonly name: Locator;
  readonly create: Locator;
  readonly cancel: Locator;
  readonly nameError: Locator;
  readonly failed: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'New workspace' });
    this.name = this.dialog.getByLabel('Name', { exact: true });
    this.create = this.dialog.getByRole('button', { name: /^Create workspace/ });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.nameError = this.dialog.getByText('Give the workspace a name.');
    this.failed = this.dialog.locator('ft-alert').filter({ hasText: 'That didn’t work' });
  }

  method(name: 'Scrum' | 'Kanban'): Locator {
    return this.dialog.getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  member(name: string): Locator {
    return this.dialog.getByRole('checkbox', { name: new RegExp(`^${name}`) });
  }
}
