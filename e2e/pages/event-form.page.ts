import { Locator, Page } from '@playwright/test';

export interface EventDetails {
  title?: string;
  type?: string;
  description?: string;
  starts?: string;
  ends?: string;
  format?: 'In person' | 'Online';
  city?: string;
  venue?: string;
  link?: string;
  visibility?: 'Public' | 'Members only';
  capacity?: string;
}

/** New event at /events/new and Edit event at /events/:id/edit (docs/mocks/pages/event-form). */
export class EventFormPage {
  readonly heading: Locator;
  readonly title: Locator;
  readonly type: Locator;
  readonly description: Locator;
  readonly starts: Locator;
  readonly ends: Locator;
  readonly city: Locator;
  readonly venue: Locator;
  readonly link: Locator;
  readonly capacity: Locator;
  readonly publish: Locator;
  readonly saveChanges: Locator;
  readonly cancel: Locator;
  readonly summary: Locator;
  readonly failed: Locator;
  readonly loading: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.title = page.getByLabel('Title', { exact: true });
    this.type = page.getByLabel('Type', { exact: true });
    this.description = page.getByLabel('Description');
    this.starts = page.getByLabel('Starts');
    this.ends = page.getByLabel('Ends');
    this.city = page.getByLabel('City', { exact: true });
    this.venue = page.getByLabel('Venue address');
    this.link = page.getByLabel('Joining link', { exact: true });
    this.capacity = page.getByLabel('Capacity');
    this.publish = page.getByRole('button', { name: 'Publish event' });
    this.saveChanges = page.getByRole('button', { name: 'Save changes' });
    this.cancel = page.getByRole('link', { name: 'Cancel' });
    this.summary = page.getByRole('alert').filter({ hasText: /Fix \d+ things?/ });
    this.failed = page.getByRole('alert').filter({ hasText: 'We couldn’t' });
    this.loading = page.getByRole('status', { name: 'Loading event' });
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load this event' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
  }

  async openNew(): Promise<void> {
    await this.page.goto('/events/new');
  }

  async openEdit(id: string): Promise<void> {
    await this.page.goto(`/events/${id}/edit`);
  }

  format(label: 'In person' | 'Online'): Locator {
    return this.page.getByRole('radio', { name: new RegExp(`^${label}`) });
  }

  visibility(label: 'Public' | 'Members only'): Locator {
    return this.page.getByRole('radio', { name: new RegExp(`^${label}`) });
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

  async fill(details: EventDetails): Promise<void> {
    if (details.title !== undefined) await this.title.fill(details.title);
    if (details.type !== undefined) await this.type.selectOption({ label: details.type });
    if (details.description !== undefined) await this.description.fill(details.description);
    if (details.starts !== undefined) await this.starts.fill(details.starts);
    if (details.ends !== undefined) await this.ends.fill(details.ends);
    if (details.format !== undefined) await this.format(details.format).check();
    if (details.city !== undefined) await this.city.fill(details.city);
    if (details.venue !== undefined) await this.venue.fill(details.venue);
    if (details.link !== undefined) await this.link.fill(details.link);
    if (details.visibility !== undefined) await this.visibility(details.visibility).check();
    if (details.capacity !== undefined) await this.capacity.fill(details.capacity);
  }
}
