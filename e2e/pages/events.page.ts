import { Locator, Page } from '@playwright/test';

export type EventChip = 'Upcoming' | 'Past' | 'Online';

/** The events list at /events (docs/mocks/pages/events). */
export class EventsPage {
  readonly heading: Locator;
  readonly newEvent: Locator;
  readonly events: Locator;
  /** The chapter filter, labelled with the organisation's singular chapter label. */
  readonly chapter: Locator;
  /** The type filter: "All types" and the organisation's types (L2-145 AC3). */
  readonly type: Locator;
  readonly skeleton: Locator;
  readonly empty: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  /** "Show all {chapters}" in the no-results state. */
  readonly showAllChapters: Locator;
  /** "Show all types" in the no-results state. */
  readonly showAllTypes: Locator;
  readonly showUpcoming: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.newEvent = page.getByRole('link', { name: 'New event' }).first();
    this.events = page.getByRole('list', { name: 'Events' }).getByRole('listitem');
    // Whatever the organisation calls a chapter, its filter is the one offering the organisation-wide events.
    this.chapter = page
      .getByRole('combobox')
      .filter({ has: page.locator('option', { hasText: '-wide' }) });
    this.type = page.getByRole('combobox', { name: 'Type', exact: true });
    this.skeleton = page.getByLabel('Loading events');
    this.empty = page.getByRole('heading', { name: 'No events yet' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load events' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.showAllChapters = page.getByRole('button', { name: /^Show all (?!types)/ });
    this.showAllTypes = page.getByRole('button', { name: 'Show all types', exact: true });
    this.showUpcoming = page.getByRole('button', { name: 'Show upcoming events' });
  }

  async open(): Promise<void> {
    await this.page.goto('/events');
  }

  filter(label: EventChip): Locator {
    return this.page
      .getByRole('group', { name: 'Filter events' })
      .getByRole('button', { name: label, exact: true });
  }

  event(title: string): Locator {
    return this.events.filter({ has: this.page.getByRole('link', { name: title, exact: true }) });
  }

  link(title: string): Locator {
    return this.event(title).getByRole('link', { name: title, exact: true });
  }

  noResults(text: string): Locator {
    return this.page.getByRole('heading', { name: text });
  }

  async titles(): Promise<string[]> {
    return this.events.getByRole('link').allTextContents();
  }
}
