import { Locator, Page } from '@playwright/test';

/** Add a hub template and Rename {name} (docs/mocks/dialogs/hub-template-name). */
export class HubTemplateNameDialog {
  readonly dialog: Locator;
  readonly name: Locator;
  readonly description: Locator;
  readonly save: Locator;
  readonly cancel: Locator;
  readonly failed: Locator;

  constructor(page: Page, heading: string) {
    this.dialog = page.getByRole('dialog', { name: heading });
    this.name = this.dialog.getByRole('textbox', { name: /^Name/ });
    this.description = this.dialog.getByRole('textbox', { name: /^Description/ });
    this.save = this.dialog.getByRole('button', {
      name: /^(Add template|Rename|Saving…|Try again)$/,
    });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.failed = this.dialog.getByText('Not saved');
  }

  error(text: string): Locator {
    return this.dialog.getByText(text);
  }
}

/** Archive {name}? (docs/mocks/dialogs/archive-hub-template). */
export class ArchiveHubTemplateDialog {
  readonly dialog: Locator;
  readonly confirm: Locator;

  constructor(page: Page, name: string) {
    this.dialog = page.getByRole('dialog', { name: `Archive ${name}?` });
    this.confirm = this.dialog.getByRole('button', {
      name: /^(Archive template|Archiving…|Try again)$/,
    });
  }
}

/** Choose sections (docs/mocks/dialogs/hub-template-sections). */
export class HubTemplateSectionsDialog {
  readonly dialog: Locator;
  readonly save: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Choose sections' });
    this.save = this.dialog.getByRole('button', { name: /^(Save|Saving…|Try again)$/ });
  }

  section(title: string): Locator {
    return this.dialog.getByRole('checkbox', { name: new RegExp(`^${title}`) });
  }

  error(text: string): Locator {
    return this.dialog.getByText(text);
  }
}
