import { Locator, Page } from '@playwright/test';

/** The Organisation section's Roles tab at /organisation/roles (docs/mocks/pages/organisation-roles). */
export class OrganisationRolesPage {
  readonly tabs: Locator;
  readonly rolesTab: Locator;
  readonly list: Locator;
  readonly archivedList: Locator;
  readonly active: Locator;
  readonly archived: Locator;
  readonly defineRole: Locator;
  readonly readOnly: Locator;
  readonly definedToast: Locator;
  readonly savedToast: Locator;
  readonly grantsSavedToast: Locator;

  constructor(private readonly page: Page) {
    const sections = page.getByRole('navigation', { name: 'Organisation settings' });
    this.tabs = sections.getByRole('link');
    this.rolesTab = sections.getByRole('link', { name: 'Roles' });
    this.list = page.getByRole('list', { name: 'Roles', exact: true });
    this.archivedList = page.getByRole('list', { name: 'Archived roles' });
    this.active = page.getByRole('button', { name: 'Active', exact: true });
    this.archived = page.getByRole('button', { name: 'Archived', exact: true });
    this.defineRole = page.getByRole('button', { name: 'Define a role' });
    this.readOnly = page.getByText('You can view these settings but not change them.');
    this.definedToast = page.locator('ft-toast').filter({ hasText: 'Role defined' });
    this.savedToast = page.locator('ft-toast').filter({ hasText: 'Role saved' });
    this.grantsSavedToast = page.locator('ft-toast').filter({ hasText: 'Grant rules saved' });
  }

  async open(): Promise<void> {
    await this.page.goto('/organisation/roles');
  }

  /** The row of the role named `name`, in whichever list is shown. */
  row(name: string): Locator {
    return this.page
      .getByRole('main')
      .getByRole('listitem')
      .filter({ has: this.page.getByText(name, { exact: true }) });
  }

  /** The role names, in the order the list shows them. */
  async names(): Promise<string[]> {
    return (await this.list.locator('.ft-list-item__title').allTextContents()).map((t) => t.trim());
  }

  edit(name: string): Locator {
    return this.page.getByRole('button', { name: `Edit ${name}`, exact: true });
  }

  whoMayGrant(name: string): Locator {
    return this.page.getByRole('button', { name: `Who may grant ${name}`, exact: true });
  }

  archive(name: string): Locator {
    return this.page.getByRole('button', { name: `Archive ${name}`, exact: true });
  }

  /** The toast "{role} archived". */
  archivedToast(name: string): Locator {
    return this.page.locator('ft-toast').filter({ hasText: `${name} archived` });
  }
}
