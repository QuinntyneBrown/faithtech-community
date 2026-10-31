import { Locator, Page } from '@playwright/test';

/** The Organisation section's Stages & types tab at /organisation/taxonomies (docs/mocks/pages/organisation-taxonomies). */
export class OrganisationTaxonomiesPage {
  readonly tab: Locator;
  readonly active: Locator;
  readonly archived: Locator;
  readonly readOnly: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  readonly stages: Locator;
  readonly archivedStages: Locator;
  readonly addStage: Locator;
  readonly types: Locator;
  readonly typesCaption: Locator;
  readonly archivedTypes: Locator;
  readonly addType: Locator;
  readonly resourceTypes: Locator;
  readonly resourceTypesCaption: Locator;
  readonly archivedResourceTypes: Locator;
  readonly addResourceType: Locator;

  constructor(private readonly page: Page) {
    this.tab = page
      .getByRole('navigation', { name: 'Organisation settings' })
      .getByRole('link', { name: 'Stages & types', exact: true });
    this.active = page.getByRole('button', { name: 'Active', exact: true });
    this.archived = page.getByRole('button', { name: 'Archived', exact: true });
    this.readOnly = page.getByText('You can view these settings but not change them.');
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load the stages and types' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.stages = page.getByRole('list', { name: 'Partner stages', exact: true });
    this.archivedStages = page.getByRole('list', { name: 'Archived partner stages' });
    this.addStage = page.getByRole('button', { name: 'Add a stage', exact: true });
    this.types = page.getByRole('list', { name: 'Event types', exact: true });
    this.typesCaption = page.getByText(
      'Offered in this order on the event form and the Events type filter.',
    );
    this.archivedTypes = page.getByRole('list', { name: 'Archived event types' });
    this.addType = page.getByRole('button', { name: 'Add an event type', exact: true });
    this.resourceTypes = page.getByRole('list', { name: 'Resource types', exact: true });
    this.resourceTypesCaption = page.getByText(
      'Offered on the add and edit resource dialogs. An upload’s type is guessed from its extension.',
    );
    this.archivedResourceTypes = page.getByRole('list', { name: 'Archived resource types' });
    this.addResourceType = page.getByRole('button', {
      name: 'Add a resource type',
      exact: true,
    });
  }

  async open(): Promise<void> {
    await this.page.goto('/organisation/taxonomies');
  }

  /** The active stage names, in the order the list shows them. */
  async stageNames(): Promise<string[]> {
    return (
      await this.stages
        .getByRole('listitem')
        .locator('.ft-reorderable-list__title')
        .allTextContents()
    ).map((t) => t.trim());
  }

  /** The active event type names, in the order the list shows them. */
  async typeNames(): Promise<string[]> {
    return (
      await this.types
        .getByRole('listitem')
        .locator('.ft-reorderable-list__title')
        .allTextContents()
    ).map((t) => t.trim());
  }

  /** The active resource type names, in the order the list shows them. */
  async resourceTypeNames(): Promise<string[]> {
    return (
      await this.resourceTypes
        .getByRole('listitem')
        .locator('.ft-reorderable-list__title')
        .allTextContents()
    ).map((t) => t.trim());
  }

  row(name: string): Locator {
    return this.page
      .getByRole('main')
      .getByRole('listitem')
      .filter({ has: this.page.getByText(name, { exact: true }) });
  }

  moveDown(name: string): Locator {
    return this.page.getByRole('button', { name: `Move ${name} down`, exact: true });
  }

  /** The row's "More actions for {name}" menu button. */
  menu(name: string): Locator {
    return this.page.getByRole('button', { name: `More actions for ${name}`, exact: true });
  }

  /** An item of the open row menu: Rename, Set as initial, Archive, or a "Counts as" choice. */
  menuItem(label: string): Locator {
    return this.page
      .getByRole('menu')
      .getByRole(/^(Open|Confirmed)$/.test(label) ? 'menuitemradio' : 'menuitem', {
        name: label,
        exact: true,
      });
  }

  /** Opens the row's menu and chooses an item. */
  async choose(name: string, item: string): Promise<void> {
    await this.menu(name).click();
    await this.menuItem(item).click();
  }

  /** A success or danger toast by its heading. */
  toast(heading: string): Locator {
    return this.page.locator('ft-toast').filter({ hasText: heading });
  }
}
