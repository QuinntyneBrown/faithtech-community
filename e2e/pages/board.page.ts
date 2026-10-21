import { Locator, Page } from '@playwright/test';

import { WorkspaceFrame } from './workspace.frame';

/** The board at /workspaces/{id} (docs/mocks/pages/team-board). */
export class BoardPage {
  readonly frame: WorkspaceFrame;
  readonly board: Locator;
  readonly columnTabs: Locator;
  readonly memberNote: Locator;
  readonly noSprint: Locator;
  readonly filter: Locator;
  readonly newStory: Locator;
  readonly loadError: Locator;

  constructor(private readonly page: Page) {
    this.frame = new WorkspaceFrame(page);
    this.board = page.getByRole('region', { name: /board$/ });
    this.columnTabs = page.getByRole('tablist', { name: /board columns$/ });
    this.memberNote = page.locator('ft-alert').filter({ hasText: /^You’re a member of/ });
    this.noSprint = page.getByRole('heading', { name: 'No sprint running' });
    this.filter = page.getByLabel('Show stories from');
    this.newStory = page.getByRole('button', { name: 'New story' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load the board' });
  }

  async open(workspaceId: string): Promise<void> {
    await this.page.goto(`/workspaces/${workspaceId}`);
  }

  column(title: 'To Do' | 'In Progress' | 'Done'): Locator {
    return this.board
      .locator('section')
      .filter({ has: this.page.getByRole('heading', { name: title, exact: true }) });
  }

  card(title: string): Locator {
    return this.board
      .getByRole('listitem')
      .filter({ has: this.page.getByRole('link', { name: title, exact: true }) });
  }

  move(title: string): Locator {
    return this.page.getByRole('button', { name: `Move ${title} to another column` });
  }

  stat(label: string): Locator {
    return this.page.getByRole('group', { name: label });
  }

  columnTab(title: string): Locator {
    return this.columnTabs.getByRole('tab', { name: new RegExp(`^${title}`) });
  }

  /** Drags a card onto another column with the mouse, the way CDK drag and drop expects. */
  async drag(title: string, to: 'To Do' | 'In Progress' | 'Done'): Promise<void> {
    const from = await this.card(title).boundingBox();
    const target = await this.column(to).boundingBox();
    await this.page.mouse.move(from!.x + 20, from!.y + 20);
    await this.page.mouse.down();
    await this.page.mouse.move(from!.x + 30, from!.y + 30, { steps: 5 });
    await this.page.mouse.move(target!.x + target!.width / 2, target!.y + 60, { steps: 10 });
    await this.page.mouse.up();
  }
}
