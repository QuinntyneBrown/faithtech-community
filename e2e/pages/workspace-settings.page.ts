import { Locator, Page } from '@playwright/test';

import { WorkspaceFrame } from './workspace.frame';

/** Workspace settings at /workspaces/{id}/settings (docs/mocks/pages/workspace-settings). */
export class WorkspaceSettingsPage {
  readonly frame: WorkspaceFrame;
  readonly name: Locator;
  readonly save: Locator;
  readonly errorSummary: Locator;
  readonly nameError: Locator;
  readonly members: Locator;
  readonly membersHeading: Locator;
  readonly addMembers: Locator;
  readonly ownerOnly: Locator;
  readonly toast: Locator;
  readonly method: Locator;
  readonly archivedItems: Locator;
  readonly archiveWorkspace: Locator;
  readonly ownerOnlyText: Locator;
  readonly needsOwner: Locator;
  readonly reassignOwner: Locator;

  constructor(private readonly page: Page) {
    this.frame = new WorkspaceFrame(page);
    this.name = page.getByLabel('Name', { exact: true });
    this.save = page.getByRole('button', { name: 'Save', exact: true });
    this.errorSummary = page.getByRole('alert').filter({ hasText: 'Fix 1 thing to save' });
    this.nameError = page.getByText('Give the workspace a name your team will recognise.').last();
    this.members = page.getByRole('list', { name: 'Members' }).getByRole('listitem');
    this.membersHeading = page.getByRole('heading', { name: /^Members/ });
    this.addMembers = page.getByRole('button', { name: 'Add members' });
    this.ownerOnly = page.getByRole('heading', { name: 'Only the owner changes settings' });
    this.ownerOnlyText = page
      .locator('ft-empty-state')
      .filter({ has: this.ownerOnly })
      .locator('p');
    this.toast = page.locator('ft-toast');
    this.method = page.locator('ft-description-list-item').filter({ hasText: 'Method' });
    this.archivedItems = page.getByRole('list', { name: 'Archived items' }).getByRole('listitem');
    this.archiveWorkspace = page.getByRole('button', { name: 'Archive workspace' });
    this.needsOwner = page
      .locator('ft-alert')
      .filter({ hasText: 'This workspace needs a new owner' });
    this.reassignOwner = page.getByRole('button', { name: 'Reassign owner' });
  }

  switchTo(method: 'Scrum' | 'Kanban'): Locator {
    return this.page.getByRole('button', { name: `Switch to ${method}` });
  }

  async open(workspaceId: string): Promise<void> {
    await this.page.goto(`/workspaces/${workspaceId}/settings`);
  }

  member(name: string): Locator {
    return this.members.filter({ hasText: name });
  }

  restore(title: string): Locator {
    return this.page.getByRole('button', { name: `Restore ${title}` });
  }

  remove(name: string): Locator {
    return this.page.getByRole('button', { name: `Remove ${name} from the workspace` });
  }
}
