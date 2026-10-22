import { Locator, Page } from '@playwright/test';

/** Check-in at the door, /events/:id/check-in (docs/mocks/pages/event-check-in). */
export class EventCheckInPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly meter: Locator;
  readonly meterCaption: Locator;
  readonly search: Locator;
  readonly attendees: Locator;
  readonly loading: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  readonly backToEvent: Locator;
  readonly empty: Locator;
  readonly clearSearch: Locator;
  readonly toasts: Locator;
  readonly undo: Locator;
  readonly addWalkIn: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header').getByText(/ · /).first();
    this.meter = page.getByRole('progressbar');
    this.meterCaption = page.locator('ft-progress').getByText(/^\d+ of \d+$/);
    this.search = page.getByRole('searchbox', { name: 'Find an attendee' });
    this.attendees = page.getByRole('list', { name: 'Attendees' }).getByRole('listitem');
    this.loading = page.getByRole('status', { name: 'Loading attendees' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load the attendee list' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.backToEvent = page.getByRole('link', { name: 'Back to the event' });
    this.empty = page.locator('ft-empty-state');
    this.clearSearch = page.getByRole('button', { name: 'Clear search' });
    this.toasts = page.locator('ft-toast-region ft-toast');
    this.undo = this.toasts.getByRole('button', { name: 'Undo' });
    this.addWalkIn = page.locator('ft-page-header').getByRole('button', { name: 'Add walk-in' });
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/events/${id}/check-in`);
  }

  attendee(name: string): Locator {
    return this.attendees.filter({ hasText: name });
  }

  /** The switch labelled "Check in {name}" (L2-093 AC6). */
  switchFor(name: string): Locator {
    return this.page.getByRole('switch', { name: `Check in ${name}` });
  }

  /** "Add walk-in" in an empty state, or "Add “{term}” as a walk-in" when no one matches. */
  emptyAction(name: string | RegExp): Locator {
    return this.empty.getByRole('button', { name });
  }

  toast(heading: string): Locator {
    return this.toasts.filter({ hasText: heading });
  }

  /** The names in list order. */
  async names(): Promise<string[]> {
    return this.attendees.locator('.ft-list-item__title').allInnerTexts();
  }
}
