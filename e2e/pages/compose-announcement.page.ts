import { Locator, Page } from '@playwright/test';

/** New announcement (docs/mocks/pages/compose-announcement). */
export class ComposeAnnouncementPage {
  readonly heading: Locator;
  readonly sendTo: Locator;
  readonly roles: Locator;
  readonly event: Locator;
  readonly subject: Locator;
  readonly message: Locator;
  readonly alsoEmail: Locator;
  readonly send: Locator;
  readonly errorSummary: Locator;
  readonly sent: Locator;
  readonly failure: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { level: 1, name: 'New announcement' });
    this.sendTo = main.getByRole('radiogroup', { name: 'Send to' });
    this.roles = main.getByRole('group', { name: 'Roles' });
    this.event = main.getByLabel('Event');
    this.subject = main.getByLabel('Subject');
    this.message = main.getByLabel('Message');
    this.alsoEmail = main.getByRole('switch', { name: /Also send by email/ });
    this.send = main.getByRole('button', { name: /^Send/ });
    this.errorSummary = main.getByRole('alert').filter({ hasText: /^Fix/ });
    this.sent = main.getByRole('status').filter({ hasText: 'Sent to' });
    this.failure = main.getByRole('alert').filter({ hasText: 'wasn’t sent' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/announcements/new');
  }

  /** "Everyone", "People with a role" or "An event’s RSVP list". */
  async chooseAudience(label: string): Promise<void> {
    await this.sendTo.getByRole('radio', { name: new RegExp(`^${label}`) }).check();
  }

  /** The labels of the roles offered as an audience, in order. */
  get roleOptions(): Locator {
    return this.roles.locator('label');
  }

  async chooseRole(label: string): Promise<void> {
    await this.roles.getByRole('checkbox', { name: label, exact: true }).check();
  }

  async write(subject: string, message: string): Promise<void> {
    await this.subject.fill(subject);
    await this.message.fill(message);
  }
}
