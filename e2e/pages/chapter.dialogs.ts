import { Locator, Page } from '@playwright/test';

/** Add a {chapter} and Rename {name} (docs/mocks/dialogs/add-chapter, rename-chapter). */
export class ChapterNameDialog {
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

/** Archive {name}? (docs/mocks/dialogs/archive-chapter). */
export class ArchiveChapterDialog {
  readonly dialog: Locator;
  readonly confirm: Locator;

  constructor(page: Page, name: string) {
    this.dialog = page.getByRole('dialog', { name: `Archive ${name}?` });
    this.confirm = this.dialog.getByRole('button', {
      name: /^(Archive \w+|Archiving…|Try again)$/,
    });
  }
}
