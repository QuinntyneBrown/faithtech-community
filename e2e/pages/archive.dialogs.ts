import { Locator, Page } from '@playwright/test';

/** Archive {workspace}? (docs/mocks/dialogs/archive-workspace). */
export class ArchiveWorkspaceDialog {
  readonly dialog: Locator;
  readonly confirm: Locator;
  readonly failed: Locator;

  constructor(page: Page, workspace: string) {
    this.dialog = page.getByRole('dialog', { name: `Archive ${workspace}?` });
    this.confirm = this.dialog.getByRole('button', { name: 'Archive workspace' });
    this.failed = this.dialog.locator('ft-alert').filter({ hasText: 'That didn’t work' });
  }
}

/** Archive “{title}”? (docs/mocks/dialogs/archive-work-item). */
export class ArchiveWorkItemDialog {
  readonly dialog: Locator;
  readonly confirm: Locator;

  constructor(page: Page, title: string) {
    this.dialog = page.getByRole('dialog', { name: `Archive “${title}”?` });
    this.confirm = this.dialog.getByRole('button', { name: 'Archive', exact: true });
  }
}

/** Choose a new owner for {workspace} (docs/mocks/dialogs/reassign-owner). */
export class ReassignOwnerDialog {
  readonly dialog: Locator;
  readonly owner: Locator;
  readonly confirm: Locator;
  readonly ownerError: Locator;

  constructor(page: Page, workspace: string) {
    this.dialog = page.getByRole('dialog', { name: `Choose a new owner for ${workspace}` });
    this.owner = this.dialog.getByRole('combobox', { name: 'New owner (City Leads only)' });
    this.confirm = this.dialog.getByRole('button', { name: 'Reassign owner' });
    this.ownerError = this.dialog.getByText('Choose who will own this workspace.').last();
  }
}
