import { Locator, Page } from '@playwright/test';

/** A public event's share page at /public/events/:id (docs/mocks/pages/public-event). */
export class PublicEventPage {
  readonly heading: Locator;
  readonly overline: Locator;
  /** The "Hosted by" fact: the organisation's short name and the event's city (L2-023 AC1). */
  readonly hostedBy: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly imGoing: Locator;
  readonly summary: Locator;
  readonly onTheList: Locator;
  readonly failure: Locator;
  readonly full: Locator;
  readonly cancelled: Locator;
  readonly signIn: Locator;
  readonly signInToRsvp: Locator;
  readonly addToCalendar: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.overline = page.getByText(/· Public event$/);
    this.hostedBy = page.locator('ft-description-list-item').filter({ hasText: 'Hosted by' });
    this.name = page.getByLabel('Your name');
    this.email = page.getByLabel('Email', { exact: true });
    this.imGoing = page.getByRole('button', { name: 'I’m going' });
    this.summary = page.getByRole('alert').filter({ hasText: /Fix \d+ things? to RSVP/ });
    this.onTheList = page.getByRole('heading', { name: /^You’re on the list/ });
    this.failure = page.getByRole('alert');
    this.full = page.getByText('This event is full', { exact: true });
    this.cancelled = page.getByText('This event was cancelled', { exact: true });
    this.signIn = page.getByRole('banner').getByRole('link', { name: 'Sign in' });
    this.signInToRsvp = page.getByRole('link', { name: 'Sign in to RSVP' });
    this.addToCalendar = page.getByRole('link', { name: 'Add to calendar (.ics)' }).first();
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load this event' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/public/events/${id}`);
  }

  async rsvp(name: string, email: string): Promise<void> {
    await this.name.fill(name);
    await this.email.fill(email);
    await this.imGoing.click();
  }

  /** The inline error under a field, read through the field's aria-describedby. */
  error(field: Locator): Promise<string> {
    return field.evaluate((el) =>
      (el.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => (id ? (document.getElementById(id)?.textContent ?? '') : ''))
        .join(' ')
        .trim(),
    );
  }
}
