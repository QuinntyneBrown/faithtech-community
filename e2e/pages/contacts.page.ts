import { Locator, Page } from '@playwright/test';

export interface PersonCard {
  root: Locator;
  name: Locator;
  photo: Locator;
  initials: Locator;
  badge: Locator;
  subtitle: Locator;
  secondary: Locator;
  viewProfile: Locator;
  dismiss: Locator;
}

/** The private contacts list at /contacts (docs/mocks/pages/contacts), a grid of person cards. */
export class ContactsPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly addContact: Locator;
  readonly archived: Locator;
  readonly search: Locator;
  readonly items: Locator;
  readonly empty: Locator;
  readonly forbidden: Locator;
  readonly joinedAlert: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header p');
    this.addContact = page.getByRole('link', { name: 'Add contact' });
    this.archived = page.getByRole('link', { name: 'Archived', exact: true });
    this.search = page.getByRole('searchbox', { name: 'Search contacts' });
    this.items = page.getByRole('list', { name: 'Contacts' }).getByRole('listitem');
    this.empty = page.getByRole('heading', { name: 'No contacts yet' });
    this.forbidden = page.getByRole('heading', { name: 'Contacts are private to each lead' });
    this.joinedAlert = page.locator('ft-alert');
  }

  async open(): Promise<void> {
    await this.page.goto('/contacts');
  }

  item(name: string): Locator {
    return this.items.filter({ hasText: name });
  }

  /** A person card (L2-072), found by the contact's name heading. */
  card(name: string): PersonCard {
    const root = this.page.getByRole('article', { name });
    return {
      root,
      name: root.getByRole('heading', { name }),
      photo: root.getByRole('img'),
      initials: root.locator('.ft-person-card__initials'),
      badge: root.locator('ft-badge'),
      subtitle: root.locator('.ft-person-card__subtitle'),
      secondary: root.locator('.ft-person-card__secondary'),
      viewProfile: root.getByRole('link', { name: `View profile ${name}` }),
      dismiss: root.getByRole('button', { name: `Archive ${name}` }),
    };
  }

  /** Every card's call to action, to check no card offers a connect or follow action. */
  get cardButtons(): Locator {
    return this.page.getByRole('list', { name: 'Contacts' }).getByRole('button');
  }

  get loadingCards(): Locator {
    return this.page.getByRole('status', { name: 'Loading contacts' });
  }

  /** How many cards share the first row of the grid. */
  async columns(): Promise<number> {
    const tops = await this.items.evaluateAll((items) =>
      items.map((item) => Math.round(item.getBoundingClientRect().top)),
    );
    return tops.filter((top) => top === tops[0]).length;
  }

  /** The heights of the cards in the first row. */
  async firstRowHeights(): Promise<number[]> {
    return this.items.evaluateAll((items) => {
      const top = Math.round(items[0].getBoundingClientRect().top);
      return items
        .filter((item) => Math.round(item.getBoundingClientRect().top) === top)
        .map((item) => Math.round(item.querySelector('article')!.getBoundingClientRect().height));
    });
  }

  async searchFor(term: string): Promise<void> {
    await this.search.fill(term);
    await this.search.press('Enter');
  }

  noResults(term: string): Locator {
    return this.page.getByRole('heading', { name: `No contacts match “${term}”` });
  }
}
