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
  readonly closeSprint: Locator;
  readonly startSprint: Locator;

  constructor(private readonly page: Page) {
    this.frame = new WorkspaceFrame(page);
    this.board = page.getByRole('region', { name: /board$/ });
    this.columnTabs = page.getByRole('tablist', { name: /board columns$/ });
    this.memberNote = page.locator('ft-alert').filter({ hasText: /^You’re a member of/ });
    this.noSprint = page.getByRole('heading', { name: 'No sprint running' });
    this.filter = page.getByLabel('Show stories from');
    this.newStory = page.getByRole('button', { name: 'New story' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load the board' });
    this.closeSprint = page.getByRole('button', { name: 'Close sprint' });
    this.startSprint = page.getByRole('button', { name: 'Start a sprint' });
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
    await this.startDrag(title, to);
    await this.drop();
  }

  /** Picks a card up and holds it over another column, so the drag preview shows there. */
  async startDrag(title: string, to: 'To Do' | 'In Progress' | 'Done'): Promise<void> {
    // The mouse only reaches what is on screen, so the card must be in the viewport first.
    await this.card(title).scrollIntoViewIfNeeded();
    const from = await this.card(title).boundingBox();
    const target = await this.column(to).boundingBox();
    // Picked up at its middle and held over the column's middle, so the preview lines up with the column.
    const grab = from!.x + from!.width / 2;
    await this.page.mouse.move(grab, from!.y + 20);
    await this.page.mouse.down();
    await this.page.mouse.move(grab + 10, from!.y + 30, { steps: 5 });
    const x = target!.x + target!.width / 2;
    await this.page.mouse.move(x, target!.y + 60, { steps: 20 });
    // A second move over the column lets CDK settle the placeholder there before the drop.
    await this.page.mouse.move(x, target!.y + 64, { steps: 2 });
  }

  /** Drops the card picked up by startDrag. */
  async drop(): Promise<void> {
    await this.page.mouse.up();
  }
}
