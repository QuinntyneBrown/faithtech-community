import { Locator, Page } from '@playwright/test';

/** The "Reorder sections" dialog on the hub home (docs/mocks/dialogs/reorder-hub-sections). */
export class ReorderHubSectionsDialog {
  readonly dialog: Locator;
  readonly heading: Locator;
  readonly rows: Locator;
  readonly announcement: Locator;
  readonly save: Locator;
  readonly cancel: Locator;
  readonly failed: Locator;
  readonly tryAgain: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Reorder sections' });
    this.heading = this.dialog.getByRole('heading', { name: 'Reorder sections' });
    this.rows = this.dialog.getByRole('listitem');
    this.announcement = this.dialog.locator('ft-reorderable-list [aria-live="polite"]');
    this.save = this.dialog.getByRole('button', { name: /^(Save|Saving…)$/ });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel', exact: true });
    this.failed = this.dialog.getByText('We couldn’t save the order');
    this.tryAgain = this.dialog.getByRole('button', { name: 'Try again' });
  }

  moveUp(title: string): Locator {
    return this.dialog.getByRole('button', { name: `Move ${title} up`, exact: true });
  }

  moveDown(title: string): Locator {
    return this.dialog.getByRole('button', { name: `Move ${title} down`, exact: true });
  }
}
