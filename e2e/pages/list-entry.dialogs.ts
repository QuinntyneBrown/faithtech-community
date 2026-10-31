import { Locator, Page } from '@playwright/test';

/** Add a partner stage and Rename {name} (docs/mocks/dialogs/add-list-entry, rename-list-entry). */
export class ListEntryNameDialog {
  readonly dialog: Locator;
  readonly name: Locator;
  readonly save: Locator;
  readonly cancel: Locator;

  constructor(page: Page, heading: string) {
    this.dialog = page.getByRole('dialog', { name: heading });
    this.name = this.dialog.getByLabel('Name', { exact: true });
    this.save = this.dialog.getByRole('button', {
      name: /^(Add \w+|Rename|Adding…|Saving…|Try again)$/,
    });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
  }

  /** The field's inline error, by the text it shows. */
  error(text: string): Locator {
    return this.dialog.getByText(text);
  }
}

/** Archive {name}? (docs/mocks/dialogs/archive-list-entry), with its in-use refusal. */
export class ArchiveListEntryDialog {
  readonly dialog: Locator;
  readonly confirm: Locator;
  readonly close: Locator;
  readonly openBoard: Locator;

  constructor(page: Page, name: string) {
    this.dialog = page.getByRole('dialog', { name: `Archive ${name}?` });
    this.confirm = this.dialog.getByRole('button', {
      name: /^(Archive \w+|Archiving…|Try again)$/,
    });
    // The footer's Close; the header's × is named Close too.
    this.close = this.dialog.getByRole('button', { name: 'Close', exact: true }).last();
    this.openBoard = this.dialog.getByRole('link', { name: 'Open the partner board' });
  }

  /** The refusal alert, "Can’t archive {name}", with the server's reason. */
  refusal(name: string): Locator {
    return this.dialog.locator('ft-alert').filter({ hasText: `Can’t archive ${name}` });
  }
}
