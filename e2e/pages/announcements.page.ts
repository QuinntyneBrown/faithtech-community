import { Locator, Page } from '@playwright/test';

/** The announcements list at /announcements (docs/mocks/pages/announcements). */
export class AnnouncementsPage {
  readonly heading: Locator;
  readonly newAnnouncement: Locator;
  readonly items: Locator;
  readonly empty: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Announcements' });
    this.newAnnouncement = page
      .getByRole('main')
      .getByRole('link', { name: 'New announcement' })
      .first();
    this.items = page.getByRole('list', { name: 'Announcements' }).getByRole('listitem');
    this.empty = page.getByRole('heading', { name: 'No announcements yet' });
  }

  async open(): Promise<void> {
    await this.page.goto('/announcements');
  }

  /** The subjects, top to bottom. */
  async subjects(): Promise<string[]> {
    return (await this.items.locator('.ft-list-item__title').allTextContents()).map((t) =>
      t.trim(),
    );
  }

  item(subject: string): Locator {
    return this.items.filter({ hasText: subject });
  }
}

/** Compose and send at /announcements/new (docs/mocks/pages/compose-announcement). */
export class ComposeAnnouncementPage {
  readonly heading: Locator;
  readonly subject: Locator;
  readonly message: Locator;
  readonly event: Locator;
  readonly alsoEmail: Locator;
  readonly errorSummary: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'New announcement' });
    this.subject = page.getByLabel('Subject');
    this.message = page.getByLabel('Message');
    this.event = page.getByLabel('Event', { exact: true });
    this.alsoEmail = page.getByRole('switch', { name: /Also send by email/ });
    this.errorSummary = page.getByRole('alert').filter({ hasText: /Fix \d+ things? to send/ });
  }

  async open(): Promise<void> {
    await this.page.goto('/announcements/new');
  }

  /** "Everyone", "People with a role" or "An event’s RSVP list". */
  audience(name: string): Locator {
    return this.page
      .getByRole('radiogroup', { name: 'Send to' })
      .getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  role(label: string): Locator {
    return this.page
      .getByRole('group', { name: 'Roles' })
      .getByRole('checkbox', { name: label, exact: true });
  }

  /** The submit button, whose label carries the recipient count: "Send to 41 people". */
  sendButton(): Locator {
    return this.page.getByRole('button', { name: /^Send/ });
  }

  /** Picks the event whose option starts with its title ("Hackathon: Tech for Shelters · Sat 14 Nov"). */
  async chooseEvent(title: string): Promise<void> {
    const option = this.event.locator('option', { hasText: title });
    await option.waitFor({ state: 'attached' });
    await this.event.selectOption({ label: (await option.textContent())!.trim() });
  }

  async send(): Promise<void> {
    await this.sendButton().click();
  }

  fieldError(message: string): Locator {
    return this.page.getByRole('main').getByText(message).first();
  }

  sentHeading(): Locator {
    return this.page.getByRole('heading', { name: /^Sent to \d+/ });
  }
}

/** The anonymous unsubscribe landing page (docs/mocks/pages/unsubscribe). */
export class UnsubscribePage {
  readonly done: Locator;
  readonly invalid: Locator;
  readonly openSettings: Locator;

  constructor(private readonly page: Page) {
    this.done = page.getByRole('heading', { level: 1, name: 'You’re unsubscribed' });
    this.invalid = page.getByRole('heading', {
      level: 1,
      name: 'This unsubscribe link doesn’t work',
    });
    this.openSettings = page.getByRole('link', { name: /settings/i });
  }

  /** Follows an email's footer link. */
  async follow(token: string): Promise<void> {
    await this.page.goto(`/unsubscribe?token=${encodeURIComponent(token)}`);
  }
}
