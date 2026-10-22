import { Locator, Page } from '@playwright/test';

/** Where a guest's cancel link lands, /public/events/:id/cancel-rsvp (docs/mocks/pages/guest-cancel-rsvp). */
export class GuestCancelRsvpPage {
  readonly heading: Locator;
  readonly question: Locator;
  readonly cancel: Locator;
  readonly keep: Locator;
  readonly cancelled: Locator;
  readonly invalid: Locator;
  readonly failed: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.question = page.getByRole('heading', { name: 'Cancel your RSVP?' });
    this.cancel = page.getByRole('button', { name: 'Cancel my RSVP' });
    this.keep = page.getByRole('link', { name: 'Keep my RSVP' });
    this.cancelled = page.getByRole('heading', { name: 'Your RSVP is cancelled' });
    this.invalid = page.getByRole('heading', { name: 'This cancel link doesn’t work' });
    this.failed = page.getByRole('alert').filter({ hasText: 'RSVP not cancelled' });
  }

  /** Follows a cancel link from a confirmation email, e.g. "/public/events/e1/cancel-rsvp?token=…". */
  async follow(link: string): Promise<void> {
    await this.page.goto(link);
  }
}
