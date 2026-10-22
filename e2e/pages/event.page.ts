import { Locator, Page } from '@playwright/test';

/** One event at /events/:id (docs/mocks/pages/event). */
export class EventPage {
  readonly heading: Locator;
  readonly rsvp: Locator;
  readonly edit: Locator;
  readonly going: Locator;
  readonly cancelMyRsvp: Locator;
  readonly refused: Locator;
  readonly full: Locator;
  readonly cancelled: Locator;
  readonly rsvpList: Locator;
  readonly rsvpListHeading: Locator;
  readonly exportCsv: Locator;
  readonly cancelEvent: Locator;
  readonly cancellation: Locator;
  readonly addToCalendar: Locator;
  readonly updateCalendar: Locator;
  readonly publicLink: Locator;
  readonly copyLink: Locator;
  readonly previewPublicPage: Locator;
  readonly loading: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.rsvp = page.getByRole('button', { name: 'RSVP', exact: true });
    this.edit = page.getByRole('link', { name: 'Edit', exact: true });
    this.going = page.getByText('You’re going', { exact: true });
    this.cancelMyRsvp = page.getByRole('button', { name: 'Cancel my RSVP' });
    this.refused = page.getByRole('alert').filter({ hasText: 'You’re not on the list' });
    this.full = page.getByText('This event is full', { exact: true });
    this.cancelled = page.getByText('This event was cancelled', { exact: true });
    this.rsvpList = page.getByRole('list', { name: 'Going' }).getByRole('listitem');
    this.rsvpListHeading = page.getByRole('heading', { name: /^Going \(\d+\)$/ });
    this.exportCsv = page.getByRole('button', { name: 'Export CSV' });
    this.cancelEvent = page.getByRole('button', { name: 'Cancel event', exact: true });
    this.cancellation = page.getByRole('alert').filter({ hasText: 'This event was cancelled' });
    this.addToCalendar = page.getByRole('button', { name: 'Add to calendar (.ics)' });
    this.updateCalendar = page.getByRole('button', { name: 'Update your calendar (.ics)' });
    this.publicLink = page.getByLabel('Link', { exact: true });
    this.copyLink = page.getByRole('button', { name: 'Copy link' });
    this.previewPublicPage = page.getByRole('link', { name: 'Preview public page' });
    this.loading = page.getByRole('status', { name: 'Loading event' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load this event' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/events/${id}`);
  }

  /** The text of a fact in "About this event", such as Going. */
  fact(term: string): Locator {
    return this.page.locator('dt', { hasText: term }).locator('xpath=following-sibling::dd[1]');
  }

  attendee(name: string): Locator {
    return this.rsvpList.filter({ hasText: name });
  }
}
