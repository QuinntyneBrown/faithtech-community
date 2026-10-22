import { Locator, Page } from '@playwright/test';

/** Switch {workspace} to {method}? (docs/mocks/dialogs/switch-method). */
export class SwitchMethodDialog {
  readonly dialog: Locator;
  readonly confirm: Locator;

  constructor(page: Page, workspace: string, method: 'Scrum' | 'Kanban') {
    this.dialog = page.getByRole('dialog', { name: `Switch ${workspace} to ${method}?` });
    this.confirm = this.dialog.getByRole('button', { name: `Switch to ${method}` });
  }
}
