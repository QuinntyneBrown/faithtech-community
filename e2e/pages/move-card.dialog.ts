import { Locator, Page } from '@playwright/test';

/** Move {story} (docs/mocks/dialogs/move-card). */
export class MoveCardDialog {
  readonly dialog: Locator;
  readonly move: Locator;

  constructor(page: Page, title: string) {
    this.dialog = page.getByRole('dialog', { name: `Move ${title}` });
    this.move = this.dialog.getByRole('button', { name: /^Move to/ });
  }

  column(name: 'To Do' | 'In Progress' | 'Done'): Locator {
    return this.dialog.getByRole('radio', { name: new RegExp(`^${name}`) });
  }
}
