import { Locator, Page } from '@playwright/test';

/** The New work item and Edit {kind} dialog (docs/mocks/dialogs/new-work-item). */
export class WorkItemDialog {
  readonly dialog: Locator;
  readonly title: Locator;
  readonly parent: Locator;
  readonly assignee: Locator;
  readonly points: Locator;
  readonly description: Locator;
  readonly ownerOnlyNote: Locator;
  readonly submit: Locator;
  readonly failed: Locator;

  constructor(page: Page, heading: string | RegExp = 'New work item') {
    this.dialog = page.getByRole('dialog', { name: heading });
    this.title = this.dialog.getByLabel('Title', { exact: true });
    this.parent = this.dialog.getByRole('combobox', { name: /^(Epic|Initiative|Story) \(/ });
    this.assignee = this.dialog.getByLabel('Assignee');
    this.points = this.dialog.getByLabel('Story points');
    this.description = this.dialog.getByRole('textbox', { name: /^Description/ });
    this.ownerOnlyNote = this.dialog.getByText('Only the owner creates initiatives and epics.');
    this.submit = this.dialog.getByRole('button', { name: /^(Create|Save)/ });
    this.failed = this.dialog.locator('ft-alert').filter({ hasText: 'That didn’t work' });
  }

  kind(name: 'Initiative' | 'Epic' | 'Story' | 'Task'): Locator {
    return this.dialog.getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  error(message: string): Locator {
    return this.dialog.getByText(message, { exact: true });
  }
}
