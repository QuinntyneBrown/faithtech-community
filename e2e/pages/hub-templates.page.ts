import { Locator, Page } from '@playwright/test';

/** The Organisation section's Hub templates tab at /organisation/hub-templates (docs/mocks/pages/organisation-hub-templates). */
export class HubTemplatesPage {
  readonly tab: Locator;
  readonly heading: Locator;
  readonly caption: Locator;
  readonly list: Locator;
  readonly archivedList: Locator;
  readonly add: Locator;
  readonly active: Locator;
  readonly archived: Locator;
  readonly readOnly: Locator;
  readonly empty: Locator;
  readonly archivedEmpty: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;

  constructor(private readonly page: Page) {
    this.tab = page
      .getByRole('navigation', { name: 'Organisation settings' })
      .getByRole('link', { name: 'Hub templates', exact: true });
    this.heading = page.getByRole('heading', { name: 'Event hub templates' });
    this.caption = page.getByText(
      'Offered in this order when someone creates an event hub. A change applies to new hubs only; hubs already started keep what they have.',
    );
    this.list = page.getByRole('list', { name: 'Event hub templates', exact: true });
    this.archivedList = page.getByRole('list', { name: 'Archived hub templates', exact: true });
    this.add = page.getByRole('button', { name: 'Add a template', exact: true }).first();
    this.active = page.getByRole('button', { name: 'Active', exact: true });
    this.archived = page.getByRole('button', { name: 'Archived', exact: true });
    this.readOnly = page.getByText('You can view these settings but not change them.');
    this.empty = page.getByRole('heading', { name: 'No hub templates yet' });
    this.archivedEmpty = page.getByRole('heading', { name: 'No archived templates' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load the hub templates' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
  }

  async open(): Promise<void> {
    await this.page.goto('/organisation/hub-templates');
  }

  /** The active template names, in the order the list shows them. */
  async names(): Promise<string[]> {
    return (await this.list.getByRole('listitem').getByRole('link').allTextContents()).map((t) =>
      t.trim(),
    );
  }

  row(name: string): Locator {
    return this.page
      .getByRole('main')
      .getByRole('listitem')
      .filter({ has: this.page.getByText(name, { exact: true }) });
  }

  link(name: string): Locator {
    return this.list.getByRole('link', { name, exact: true });
  }

  menu(name: string): Locator {
    return this.page.getByRole('button', { name: `More actions for ${name}`, exact: true });
  }

  restore(name: string): Locator {
    return this.row(name).getByRole('button', { name: /^Restore/ });
  }

  async choose(name: string, item: string): Promise<void> {
    await this.menu(name).click();
    await this.page.getByRole('menuitem', { name: item, exact: true }).click();
  }

  toast(heading: string): Locator {
    return this.page.locator('ft-toast').filter({ hasText: heading });
  }
}

/** One template's page at /organisation/hub-templates/{id} (docs/mocks/pages/organisation-hub-template). */
export class HubTemplatePage {
  readonly back: Locator;
  readonly rename: Locator;
  readonly chooseSections: Locator;
  readonly sections: Locator;
  readonly readOnly: Locator;
  readonly archivedNotice: Locator;
  readonly restore: Locator;
  readonly notFound: Locator;
  readonly loadError: Locator;

  constructor(private readonly page: Page) {
    this.back = page.getByRole('link', { name: 'All hub templates', exact: true });
    this.rename = page.getByRole('main').getByRole('button', { name: 'Rename', exact: true });
    this.chooseSections = page.getByRole('button', { name: 'Choose sections', exact: true });
    this.sections = page.getByRole('list', { name: /^Sections of / });
    this.readOnly = page.getByText('You can view these settings but not change them.');
    this.archivedNotice = page.getByText('This template is archived');
    this.restore = page.getByRole('main').getByRole('button', { name: 'Restore', exact: true });
    this.notFound = page.getByRole('heading', { name: 'We couldn’t find that template' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load this template' });
  }

  heading(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true, level: 2 });
  }

  /** A section's row, by its title. */
  row(title: string): Locator {
    return this.sections
      .getByRole('listitem')
      .filter({ has: this.page.getByText(title, { exact: true }) });
  }

  editDefault(title: string): Locator {
    return this.page.getByRole('button', { name: `Edit default text for ${title}`, exact: true });
  }

  async sectionTitles(): Promise<string[]> {
    return (await this.sections.locator('.ft-list-item__title').allTextContents()).map((t) =>
      t.trim(),
    );
  }

  toast(heading: string): Locator {
    return this.page.locator('ft-toast').filter({ hasText: heading });
  }
}
