import { Locator, Page } from '@playwright/test';

/** "Add a link card" (docs/mocks/dialogs/add-link-card). */
export class LinkCardDialog {
  readonly dialog: Locator;
  readonly link: Locator;
  readonly caption: Locator;
  readonly add: Locator;
  readonly cancel: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Add a link card' });
    this.link = this.dialog.getByRole('textbox', { name: 'Link' });
    this.caption = this.dialog.getByRole('textbox', { name: 'Caption (optional)' });
    this.add = this.dialog.getByRole('button', { name: 'Add link card' });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
  }
}
