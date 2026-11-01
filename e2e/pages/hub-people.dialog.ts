import { Locator, Page } from '@playwright/test';

import { HubSectionDialog } from './hub-section.dialog';

/**
 * The People wizard (docs/mocks/dialogs/hub-people): the people list with a role on the day each, the member search,
 * the guest form, and the review's groups.
 */
export class HubPeopleDialog extends HubSectionDialog {
  readonly people: Locator;
  readonly empty: Locator;
  readonly memberSearch: Locator;
  readonly addGuest: Locator;
  readonly guestName: Locator;
  readonly guestAbout: Locator;
  readonly guestRole: Locator;
  readonly addGuestConfirm: Locator;
  readonly guestNote: Locator;

  constructor(page: Page) {
    super(page, 'People');
    this.people = this.dialog.getByRole('list', { name: 'People', exact: true });
    this.empty = this.dialog.getByText('No one yet. Add a member or a guest.');
    this.memberSearch = this.dialog.getByRole('combobox', { name: /^Add a member/ });
    this.addGuest = this.dialog.getByRole('button', { name: 'Add a guest', exact: true });
    this.guestName = this.dialog.getByRole('textbox', { name: /^Name/ });
    this.guestAbout = this.dialog.getByRole('textbox', { name: /^About them/ });
    this.guestRole = this.dialog.getByRole('combobox', {
      name: /^Role on the day( \(optional\))?$/,
    });
    this.addGuestConfirm = this.dialog.getByRole('button', { name: 'Add guest', exact: true });
    this.guestNote = this.dialog.getByText(
      'Guests appear on this hub only; they don’t get a profile.',
    );
  }

  /** Searches members and picks one from the suggestions. */
  async addMember(search: string, name: string): Promise<void> {
    await this.memberSearch.fill(search);
    await this.dialog.getByRole('option', { name: new RegExp(`^${name}`) }).click();
  }

  person(name: string): Locator {
    return this.people.getByRole('listitem').filter({ hasText: name });
  }

  roleOf(name: string): Locator {
    return this.dialog.getByRole('combobox', { name: `Role on the day for ${name}`, exact: true });
  }

  remove(name: string): Locator {
    return this.dialog.getByRole('button', { name: `Remove ${name}`, exact: true });
  }

  /** A group in the review or the display, such as "Speakers", as its list of names. */
  group(name: string): Locator {
    return this.dialog.getByRole('list', { name, exact: true });
  }
}
