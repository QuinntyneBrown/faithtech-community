import { Locator, Page } from '@playwright/test';

/** Add members to {workspace} (docs/mocks/dialogs/add-workspace-member). */
export class AddWorkspaceMembersDialog {
  readonly dialog: Locator;
  readonly add: Locator;
  readonly noneChosen: Locator;

  constructor(page: Page, workspace: string) {
    this.dialog = page.getByRole('dialog', { name: `Add members to ${workspace}` });
    this.add = this.dialog.getByRole('button', { name: /^Add members/ });
    this.noneChosen = this.dialog.getByText('Choose at least one person.');
  }

  person(name: string): Locator {
    return this.dialog.getByRole('checkbox', { name: new RegExp(`^${name}`) });
  }
}

/** Remove {name} from {workspace}? (docs/mocks/dialogs/remove-workspace-member). */
export class RemoveWorkspaceMemberDialog {
  readonly dialog: Locator;
  readonly remove: Locator;

  constructor(page: Page, name: string, workspace: string) {
    this.dialog = page.getByRole('dialog', { name: `Remove ${name} from ${workspace}?` });
    this.remove = this.dialog.getByRole('button', { name: /^Remove member/ });
  }
}
