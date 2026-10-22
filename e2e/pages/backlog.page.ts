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
  readonly sprint: Locator;
  readonly startSprint: Locator;
  readonly treeView: Locator;
  readonly historyView: Locator;
  readonly history: Locator;
  readonly average: Locator;

  constructor(private readonly page: Page) {
    this.frame = new WorkspaceFrame(page);
    this.tree = page.getByRole('list', { name: 'Backlog hierarchy' });
    this.filter = page.getByLabel('Show stories from');
    this.newItem = page.getByRole('button', { name: 'New item' }).first();
    this.empty = page.getByRole('heading', { name: 'Nothing in the backlog' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load the backlog' });
    // The newest toast: an earlier one may still be counting down beside it.
    this.toast = page.locator('ft-toast').last();
    this.sprint = page.getByRole('region', { name: /^Sprint \d+ ·/ });
    this.startSprint = page.getByRole('button', { name: 'Start sprint' });
    this.treeView = page.getByRole('button', { name: 'Tree', exact: true });
    this.historyView = page.getByRole('button', { name: 'Sprint history', exact: true });
    this.history = page.getByRole('table', { name: 'Closed sprints and completed points' });
    this.average = page.getByText(/Average: \d+ points per sprint\./);
  }

  historyRow(name: string): Locator {
    return this.history.getByRole('row').filter({ hasText: name });
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
