import { Locator, Page } from '@playwright/test';

/** The Add a resource dialog (docs/mocks/dialogs/add-resource). */
export class AddResourceDialog {
  readonly dialog: Locator;
  readonly uploadTab: Locator;
  readonly linkTab: Locator;
  readonly fileInput: Locator;
  readonly files: Locator;
  readonly link: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly type: Locator;
  readonly tags: Locator;
  readonly tagSuggestions: Locator;
  readonly people: Locator;
  readonly peopleSuggestions: Locator;
  readonly errorSummary: Locator;
  readonly alert: Locator;
  readonly cancel: Locator;
  readonly cancelRemaining: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Add a resource' });
    this.uploadTab = this.dialog.getByRole('tab', { name: 'Upload files' });
    this.linkTab = this.dialog.getByRole('tab', { name: 'Add a link' });
    this.fileInput = this.dialog.locator('input[type=file]');
    this.files = this.dialog.getByRole('list', { name: 'Chosen files' }).getByRole('listitem');
    this.link = this.dialog.getByRole('textbox', { name: 'Link' });
    this.title = this.dialog.getByRole('textbox', { name: 'Title' });
    this.description = this.dialog.getByRole('textbox', { name: 'Description' });
    this.type = this.dialog.getByRole('combobox', { name: 'Type' });
    this.tags = this.dialog.getByRole('combobox', { name: 'Tags' });
    this.tagSuggestions = this.dialog.getByRole('listbox', { name: 'Tags already in use' });
    this.people = this.dialog.getByRole('combobox', { name: 'People' });
    this.peopleSuggestions = this.dialog.getByRole('listbox', { name: 'Members' });
    this.errorSummary = this.dialog.getByRole('alert').filter({ hasText: /^Fix \d/ });
    this.alert = this.dialog.locator('ft-alert');
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel', exact: true });
    this.cancelRemaining = this.dialog.getByRole('button', { name: 'Cancel remaining' });
  }

  /** The primary button, whatever it reads now ("Add resource", "Add 3 resources", "Add link"…). */
  submit(name: string | RegExp): Locator {
    return this.dialog.getByRole('button', { name, exact: typeof name === 'string' });
  }

  async choose(...files: { name: string; mimeType?: string; buffer: Buffer }[]): Promise<void> {
    await this.fileInput.setInputFiles(
      files.map((f) => ({ mimeType: 'application/octet-stream', ...f })),
    );
  }

  file(name: string): Locator {
    return this.files.filter({ hasText: name });
  }

  visibility(name: 'Private' | 'Shared' | 'Global'): Locator {
    return this.dialog.getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  role(name: string): Locator {
    return this.dialog
      .getByRole('group', { name: 'Roles' })
      .getByRole('checkbox', { name, exact: true });
  }

  async addTag(tag: string): Promise<void> {
    await this.tags.fill(tag);
    await this.tags.press('Enter');
  }

  async sharePerson(query: string, name: string): Promise<void> {
    await this.people.fill(query);
    await this.peopleSuggestions.getByRole('option', { name: new RegExp(name) }).click();
  }

  /** Waits until the dialog has finished animating in, so colours are measured at full opacity. */
  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}

/** The Edit resource dialog (docs/mocks/dialogs/edit-resource). */
export class EditResourceDialog {
  readonly dialog: Locator;
  readonly title: Locator;
  readonly replace: Locator;
  readonly fileInput: Locator;
  readonly warning: Locator;
  readonly save: Locator;
  readonly alert: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: /^Edit / });
    this.title = this.dialog.getByRole('textbox', { name: 'Title' });
    this.replace = this.dialog.getByRole('button', { name: 'Replace file' });
    this.fileInput = this.dialog.locator('input[type=file]');
    this.warning = this.dialog.locator('ft-alert').filter({ hasText: 'This replaces' });
    this.save = this.dialog.getByRole('button', {
      name: /^(Save changes|Save and replace file|Try again)$/,
    });
    this.alert = this.dialog.locator('ft-alert');
  }

  visibility(name: 'Private' | 'Shared' | 'Global'): Locator {
    return this.dialog.getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  role(name: string): Locator {
    return this.dialog
      .getByRole('group', { name: 'Roles' })
      .getByRole('checkbox', { name, exact: true });
  }

  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}

/** The Archive resource confirmation (docs/mocks/dialogs/archive-resource). */
export class ArchiveResourceDialog {
  readonly dialog: Locator;
  readonly archive: Locator;
  readonly cancel: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: /^Archive / });
    this.archive = this.dialog.getByRole('button', { name: 'Archive', exact: true });
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
  }

  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}

/** The Transfer ownership dialog (docs/mocks/dialogs/transfer-resource-owner). */
export class TransferOwnershipDialog {
  readonly dialog: Locator;
  readonly owner: Locator;
  readonly suggestions: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Transfer ownership' });
    this.owner = this.dialog.getByRole('combobox', { name: 'New owner' });
    this.suggestions = this.dialog.getByRole('listbox', { name: 'Members who can own resources' });
    this.error = this.dialog.locator('ft-inline-message, .ft-form-field__error');
  }

  submit(name: string | RegExp): Locator {
    return this.dialog.getByRole('button', { name });
  }

  async choose(query: string, name: string): Promise<void> {
    await this.owner.fill(query);
    await this.suggestions.getByRole('option', { name: new RegExp(name) }).click();
  }

  async opened(): Promise<void> {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
  }
}
