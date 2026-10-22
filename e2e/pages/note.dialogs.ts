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

/** "Add a link" and "Edit link" (docs/mocks/dialogs/add-link). */
export class LinkDialog {
  readonly dialog: Locator;
  readonly link: Locator;
  readonly save: Locator;
  readonly remove: Locator;

  constructor(page: Page, heading: 'Add a link' | 'Edit link' = 'Add a link') {
    this.dialog = page.getByRole('dialog', { name: heading });
    this.link = this.dialog.getByRole('textbox', { name: 'Link' });
    this.save = this.dialog.getByRole('button', {
      name: heading === 'Add a link' ? 'Add link' : 'Save',
    });
    this.remove = this.dialog.getByRole('button', { name: 'Remove link' });
  }
}

/** "Move {title}" (docs/mocks/dialogs/move-note). */
export class MoveNoteDialog {
  readonly dialog: Locator;
  readonly search: Locator;
  readonly topLevel: Locator;
  readonly move: Locator;

  constructor(page: Page, title: string) {
    this.dialog = page.getByRole('dialog', { name: `Move ${title}` });
    this.search = this.dialog.getByRole('searchbox', { name: 'Search your pages' });
    this.topLevel = this.dialog.getByRole('radio', { name: 'Top level (no parent)' });
    this.move = this.dialog.getByRole('button', { name: 'Move', exact: true });
  }

  option(title: string): Locator {
    return this.dialog.getByRole('radio', { name: new RegExp(`^${title}`) });
  }
}

/** "Share {title}" (docs/mocks/dialogs/share-note). */
export class ShareNoteDialog {
  readonly dialog: Locator;
  readonly people: Locator;
  readonly peopleSuggestions: Locator;
  readonly save: Locator;

  constructor(page: Page, title: string) {
    this.dialog = page.getByRole('dialog', { name: `Share ${title}` });
    this.people = this.dialog.getByRole('combobox', { name: 'People' });
    this.peopleSuggestions = this.dialog.getByRole('listbox', { name: 'Members' });
    this.save = this.dialog.getByRole('button', { name: 'Save', exact: true });
  }

  visibility(name: 'Private' | 'Shared' | 'Global'): Locator {
    return this.dialog.getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  role(name: string): Locator {
    return this.dialog
      .getByRole('group', { name: 'Roles' })
      .getByRole('checkbox', { name, exact: true });
  }

  async sharePerson(query: string, name: string): Promise<void> {
    await this.people.fill(query);
    await this.peopleSuggestions.getByRole('option', { name: new RegExp(name) }).click();
  }
}

/** "Page settings" (docs/mocks/dialogs/note-settings). */
export class PageSettingsDialog {
  readonly dialog: Locator;
  readonly title: Locator;
  readonly save: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Page settings' });
    this.title = this.dialog.getByRole('textbox', { name: 'Title' });
    this.save = this.dialog.getByRole('button', { name: 'Save', exact: true });
  }

  icon(name: string): Locator {
    return this.dialog.getByRole('radio', { name, exact: true });
  }
}

/** "Change icon" for a callout. */
export class IconDialog {
  readonly dialog: Locator;
  readonly save: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Change icon' });
    this.save = this.dialog.getByRole('button', { name: 'Save', exact: true });
  }

  icon(name: string): Locator {
    return this.dialog.getByRole('radio', { name, exact: true });
  }
}
