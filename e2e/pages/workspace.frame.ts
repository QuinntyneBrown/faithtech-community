import { Locator, Page } from '@playwright/test';

/** The chrome every workspace page shares: breadcrumb, title and section tabs (docs/mocks/pages/team-board). */
export class WorkspaceFrame {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly sections: Locator;
  readonly notMember: Locator;
  readonly readOnly: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header p');
    this.sections = page.getByRole('navigation', { name: 'Workspace sections' });
    this.notMember = page.getByRole('heading', { name: 'You’re not a member of this workspace' });
    this.readOnly = page.locator('ft-alert').filter({ hasText: 'Read-only for Staff' });
  }

  section(name: string): Locator {
    return this.sections.getByRole('link', { name, exact: true });
  }
}
