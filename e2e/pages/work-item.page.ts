import { Locator, Page } from '@playwright/test';

/** One work item at /workspaces/{id}/items/{itemId} (docs/mocks/pages/work-item). */
export class WorkItemPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly description: Locator;
  readonly edit: Locator;
  readonly tasksHeading: Locator;
  readonly tasks: Locator;
  readonly newTask: Locator;
  readonly addTask: Locator;
  readonly noTasks: Locator;
  readonly status: Locator;
  readonly details: Locator;
  readonly commentBox: Locator;
  readonly comment: Locator;
  readonly comments: Locator;
  readonly commentsHeading: Locator;
  readonly readOnly: Locator;
  readonly notMember: Locator;
  readonly loadError: Locator;
  readonly toast: Locator;
  readonly addToSprint: Locator;
  readonly archive: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header p');
    this.description = page.getByRole('region', { name: 'Description' });
    this.edit = page.getByRole('button', { name: 'Edit', exact: true });
    this.tasksHeading = page.getByRole('heading', { name: /^Tasks/ });
    this.tasks = page.getByRole('group', { name: 'Tasks' }).getByRole('checkbox');
    this.newTask = page.getByLabel('New task');
    this.addTask = page.getByRole('button', { name: /^Add( task)?$/ });
    this.noTasks = page.getByRole('heading', { name: 'No tasks yet' });
    this.status = page.getByLabel('Status', { exact: true });
    this.details = page.getByRole('region', { name: 'Details' });
    this.commentBox = page.getByRole('textbox', { name: /^Add a comment/ });
    this.comment = page.getByRole('button', { name: 'Comment', exact: true });
    this.comments = page.getByRole('list', { name: 'Comments' }).getByRole('listitem');
    this.commentsHeading = page.getByRole('heading', { name: /^Comments/ });
    this.readOnly = page.locator('ft-alert').filter({ hasText: 'Read-only for Staff' });
    this.notMember = page.getByRole('heading', { name: 'You’re not a member of this workspace' });
    this.loadError = page.getByRole('heading', { name: /^We couldn’t load this/ });
    this.toast = page.locator('ft-toast');
    this.addToSprint = page.getByRole('button', { name: /^Add to Sprint/ });
    this.archive = page.getByRole('button', { name: 'Archive', exact: true });
  }

  async open(workspaceId: string, itemId: string): Promise<void> {
    await this.page.goto(`/workspaces/${workspaceId}/items/${itemId}`);
  }

  task(title: string): Locator {
    return this.page.getByRole('checkbox', { name: new RegExp(`^${title}`) });
  }

  fact(label: string): Locator {
    return this.details.locator('ft-description-list-item').filter({ hasText: label });
  }
}
