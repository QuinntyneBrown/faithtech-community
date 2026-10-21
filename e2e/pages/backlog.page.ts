import { Locator, Page } from '@playwright/test';

import { WorkspaceFrame } from './workspace.frame';

/** The backlog at /workspaces/{id}/backlog (docs/mocks/pages/backlog). */
export class BacklogPage {
  readonly frame: WorkspaceFrame;
  readonly tree: Locator;
  readonly filter: Locator;
  readonly newItem: Locator;
  readonly empty: Locator;
  readonly loadError: Locator;
  readonly toast: Locator;

  constructor(private readonly page: Page) {
    this.frame = new WorkspaceFrame(page);
    this.tree = page.getByRole('list', { name: 'Backlog hierarchy' });
    this.filter = page.getByLabel('Show stories from');
    this.newItem = page.getByRole('button', { name: 'New item' }).first();
    this.empty = page.getByRole('heading', { name: 'Nothing in the backlog' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load the backlog' });
    this.toast = page.locator('ft-toast');
  }

  async open(workspaceId: string): Promise<void> {
    await this.page.goto(`/workspaces/${workspaceId}/backlog`);
  }

  /** A tree row by its title, including its kind badge and caption. */
  row(title: string): Locator {
    return this.tree
      .locator('summary, .ft-tree-item__row')
      .filter({ has: this.page.getByText(title, { exact: true }) });
  }

  link(title: string): Locator {
    return this.tree.getByRole('link', { name: title, exact: true });
  }
}
