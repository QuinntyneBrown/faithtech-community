import { Locator, Page } from '@playwright/test';

/** Add or edit a contact at /contacts/new and /contacts/:id/edit (docs/mocks/pages/contact-form). */
export class ContactFormPage {
  readonly heading: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly phone: Locator;
  readonly organisation: Locator;
  readonly city: Locator;
  readonly firstNote: Locator;
  readonly save: Locator;
  readonly saveAndLink: Locator;
  readonly summary: Locator;
  readonly memberAlert: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.name = page.getByRole('textbox', { name: 'Name', exact: true });
    this.email = page.getByRole('textbox', { name: /^Email/ });
    this.phone = page.getByRole('textbox', { name: /^Phone/ });
    this.organisation = page.getByRole('textbox', { name: /^Organisation/ });
    this.city = page.getByRole('textbox', { name: /^City/ });
    this.firstNote = page.getByRole('textbox', { name: /^First note/ });
    this.save = page.getByRole('button', { name: 'Save contact' });
    this.saveAndLink = page.getByRole('button', { name: 'Save and link' });
    this.summary = page.locator('ft-error-summary');
    this.memberAlert = page.locator('ft-alert', { hasText: 'is already a member' });
  }

  async openNew(): Promise<void> {
    await this.page.goto('/contacts/new');
  }

  error(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }
}
