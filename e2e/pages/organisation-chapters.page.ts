import { Locator, Page } from '@playwright/test';

/** The Organisation section's chapters tab at /organisation/chapters (docs/mocks/pages/organisation-chapters). */
export class OrganisationChaptersPage {
  readonly tabs: Locator;
  readonly active: Locator;
  readonly archived: Locator;
  readonly readOnly: Locator;
  readonly chaptersOff: Locator;
  readonly goToGeneral: Locator;
  readonly announcement: Locator;

  constructor(private readonly page: Page) {
    const sections = page.getByRole('navigation', { name: 'Organisation settings' });
    this.tabs = sections.getByRole('link');
    this.active = page.getByRole('button', { name: 'Active', exact: true });
    this.archived = page.getByRole('button', { name: 'Archived', exact: true });
    this.readOnly = page.getByText('You can view these settings but not change them.');
    this.chaptersOff = page.getByRole('heading', { name: 'Chapters are off' });
    this.goToGeneral = page.getByRole('link', { name: 'Go to General' });
    this.announcement = page.locator('ft-reorderable-list [aria-live="polite"]');
  }

  async open(): Promise<void> {
    await this.page.goto('/organisation/chapters');
  }

  /** The tab named by the plural label, or "Chapters" while they are off. */
  tab(name: string): Locator {
    return this.page
      .getByRole('navigation', { name: 'Organisation settings' })
      .getByRole('link', { name, exact: true });
  }

  /** The list of active chapters, named by the plural label. */
  list(plural: string): Locator {
    return this.page.getByRole('list', { name: plural, exact: true });
  }

  archivedList(plural: string): Locator {
    return this.page.getByRole('list', { name: `Archived ${plural.toLowerCase()}` });
  }

  /** The chapter names, in the order the list shows them. */
  async names(plural: string): Promise<string[]> {
    return (
      await this.list(plural)
        .getByRole('listitem')
        .locator('.ft-reorderable-list__title')
        .allTextContents()
    ).map((t) => t.trim());
  }

  row(name: string): Locator {
    return this.page.getByRole('main').getByRole('listitem').filter({ hasText: name });
  }

  add(singular: string): Locator {
    return this.page.getByRole('button', { name: `Add a ${singular.toLowerCase()}`, exact: true });
  }

  moveUp(name: string): Locator {
    return this.page.getByRole('button', { name: `Move ${name} up`, exact: true });
  }

  moveDown(name: string): Locator {
    return this.page.getByRole('button', { name: `Move ${name} down`, exact: true });
  }

  rename(name: string): Locator {
    return this.page.getByRole('button', { name: `Rename ${name}`, exact: true });
  }

  archive(name: string): Locator {
    return this.page.getByRole('button', { name: `Archive ${name}`, exact: true });
  }

  /** A success or danger toast by its heading. */
  toast(heading: string): Locator {
    return this.page.locator('ft-toast').filter({ hasText: heading });
  }
}
