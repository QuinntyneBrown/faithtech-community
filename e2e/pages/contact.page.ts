import { Locator, Page } from '@playwright/test';

/** One private contact at /contacts/:id (docs/mocks/pages/contact). */
export class ContactPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly edit: Locator;
  readonly details: Locator;
  readonly notFound: Locator;
  readonly addNote: Locator;
  readonly archive: Locator;
  readonly matchAlert: Locator;
  readonly linkToProfile: Locator;
  readonly notThem: Locator;
  readonly linkedAlert: Locator;
  readonly notes: Locator;
  readonly photoFailedAlert: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header p');
    this.edit = page.getByRole('link', { name: 'Edit' });
    this.details = page.locator('ft-description-list');
    this.notFound = page.getByRole('heading', { name: 'We couldn’t find that contact' });
    this.addNote = page.getByRole('button', { name: 'Add note' });
    this.archive = page.getByRole('button', { name: 'Archive' });
    this.matchAlert = page.locator('ft-alert', { hasText: 'has joined FaithTech' });
    this.linkToProfile = page.getByRole('button', { name: 'Link to their profile' });
    this.notThem = page.getByRole('button', { name: 'Not them' });
    this.linkedAlert = page.locator('ft-alert', { hasText: 'member profile' });
    this.notes = page.locator('ft-note');
    this.photoFailedAlert = page.locator('ft-alert', { hasText: 'wasn’t added' });
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/contacts/${id}`);
  }

  detail(label: string): Locator {
    return this.page
      .locator('dl', { has: this.page.getByText(label, { exact: true }) })
      .locator('dd');
  }
}
