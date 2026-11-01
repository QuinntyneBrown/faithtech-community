import { Locator, Page } from '@playwright/test';

import { HubSectionDialog } from './hub-section.dialog';

/** The Agenda wizard (docs/mocks/dialogs/hub-agenda): rows, adding, pasting a schedule and the review. */
export class HubAgendaDialog extends HubSectionDialog {
  readonly rows: Locator;
  readonly empty: Locator;
  readonly announcement: Locator;
  readonly time: Locator;
  readonly what: Locator;
  readonly detail: Locator;
  readonly addRow: Locator;
  readonly pasteSchedule: Locator;
  readonly schedule: Locator;
  readonly readSchedule: Locator;
  readonly found: Locator;
  readonly addTheseRows: Locator;
  readonly review: Locator;

  constructor(page: Page) {
    super(page, 'Agenda');
    this.rows = this.dialog.getByRole('list', { name: 'Agenda rows' }).getByRole('listitem');
    this.empty = this.dialog.getByText('No rows yet. Add the first one, or paste a schedule.');
    this.announcement = this.dialog.locator('ft-reorderable-list [aria-live="polite"]');
    this.time = this.dialog.getByLabel('Time', { exact: true });
    this.what = this.dialog.getByRole('textbox', { name: /^What’s happening/ });
    this.detail = this.dialog.getByRole('textbox', { name: /^Detail/ });
    this.addRow = this.dialog.getByRole('button', { name: /^(Add row|Update row)$/ });
    this.pasteSchedule = this.dialog.getByRole('button', { name: 'Paste a schedule' });
    this.schedule = this.dialog.getByRole('textbox', { name: /^Paste your schedule/ });
    this.readSchedule = this.dialog.getByRole('button', { name: 'Read schedule' });
    this.found = this.dialog.getByRole('list', { name: /^We found/ });
    this.addTheseRows = this.dialog.getByRole('button', { name: 'Add these rows' });
    this.review = this.dialog.getByRole('list', { name: 'Agenda' });
  }

  /** A row by its title. */
  row(title: string): Locator {
    return this.rows.filter({ hasText: title });
  }

  /** Each row as "{time} {title}", in order. */
  async summary(): Promise<string[]> {
    const rows = await this.rows.all();
    return Promise.all(
      rows.map(async (row) => {
        const time = await row.locator('.ft-reorderable-list__lead').innerText();
        const title = await row.locator('.ft-reorderable-list__title').innerText();
        return `${time.trim()} ${title.trim()}`;
      }),
    );
  }

  moveDown(title: string): Locator {
    return this.dialog.getByRole('button', { name: `Move ${title} down`, exact: true });
  }

  moveUp(title: string): Locator {
    return this.dialog.getByRole('button', { name: `Move ${title} up`, exact: true });
  }

  edit(title: string): Locator {
    return this.dialog.getByRole('button', { name: `Edit ${title}`, exact: true });
  }

  remove(title: string): Locator {
    return this.dialog.getByRole('button', { name: `Remove ${title}`, exact: true });
  }
}
