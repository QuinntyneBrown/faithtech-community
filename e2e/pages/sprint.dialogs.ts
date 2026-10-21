import { Locator, Page } from '@playwright/test';

/** Start a sprint (docs/mocks/dialogs/start-sprint). */
export class StartSprintDialog {
  readonly dialog: Locator;
  readonly name: Locator;
  readonly goal: Locator;
  readonly starts: Locator;
  readonly ends: Locator;
  readonly stories: Locator;
  readonly average: Locator;
  readonly start: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Start a sprint' });
    this.name = this.dialog.getByLabel('Name', { exact: true });
    this.goal = this.dialog.getByLabel('Goal', { exact: true });
    this.starts = this.dialog.getByLabel('Starts', { exact: true });
    this.ends = this.dialog.getByLabel('Ends', { exact: true });
    this.stories = this.dialog.getByRole('group', { name: /^Stories from the backlog/ });
    this.average = this.dialog.getByText(/^Only one sprint can be active at a time\./);
    this.start = this.dialog.getByRole('button', { name: /^Start sprint/ });
  }

  story(title: string): Locator {
    return this.dialog.getByRole('checkbox', { name: new RegExp(`^${title}`) });
  }

  error(message: string): Locator {
    return this.dialog.getByText(message, { exact: true });
  }
}

/** Close {sprint}? (docs/mocks/dialogs/close-sprint). */
export class CloseSprintDialog {
  readonly dialog: Locator;
  readonly unfinished: Locator;
  readonly close: Locator;

  constructor(page: Page, sprint: string) {
    this.dialog = page.getByRole('dialog', { name: `Close ${sprint}?` });
    this.unfinished = this.dialog.getByRole('listitem');
    this.close = this.dialog.getByRole('button', { name: /^Close sprint/ });
  }
}
