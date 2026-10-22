import { Locator, Page } from '@playwright/test';

export type PipelineStage = 'Lead' | 'In funnel' | 'Confirmed';

/** Home at / (docs/mocks/pages/home): greeting, Coming up, Partner pipeline and Recent activity. */
export class HomePage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly newEvent: Locator;
  readonly addContact: Locator;
  readonly staffBanner: Locator;
  readonly comingUp: Locator;
  readonly comingUpEvents: Locator;
  readonly comingUpLoading: Locator;
  readonly nothingComingUp: Locator;
  readonly allEvents: Locator;
  readonly pipeline: Locator;
  readonly openBoard: Locator;
  readonly noPartners: Locator;
  readonly pipelineError: Locator;
  readonly activity: Locator;
  readonly activityItems: Locator;
  readonly activityLoading: Locator;
  readonly noActivity: Locator;
  readonly activityError: Locator;
  readonly pageError: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('main .page-header__subtitle');
    const main = page.getByRole('main');
    this.newEvent = main.getByRole('link', { name: 'New event' });
    this.addContact = main.getByRole('link', { name: 'Add contact' });
    this.staffBanner = page.getByRole('status').filter({ hasText: 'You’re viewing as Staff' });
    this.comingUp = page.getByRole('region', { name: 'Coming up' });
    this.comingUpEvents = this.comingUp.getByRole('listitem');
    this.comingUpLoading = page.getByRole('status', { name: 'Loading your events' });
    this.nothingComingUp = this.comingUp.getByText('Nothing coming up yet.');
    this.allEvents = this.comingUp.getByRole('link', { name: 'All events' });
    this.pipeline = page.getByRole('region', { name: 'Partner pipeline' });
    this.openBoard = this.pipeline.getByRole('link', { name: 'Open board' });
    this.noPartners = this.pipeline.getByText('No partners yet. Add the first one from the board.');
    this.pipelineError = this.pipeline.getByRole('alert');
    this.activity = page.getByRole('region', { name: 'Recent activity' });
    this.activityItems = this.activity.getByRole('listitem');
    this.activityLoading = page.getByRole('list', { name: 'Loading recent activity' });
    this.noActivity = this.activity.getByText(
      'No activity yet. New sign-ups, events and announcements show up here.',
    );
    this.activityError = this.activity.getByRole('alert');
    this.pageError = page.getByRole('heading', { name: 'We couldn’t load your home page' });
  }

  async open(): Promise<void> {
    await this.page.goto('/');
  }

  comingUpLink(title: string): Locator {
    return this.comingUp.getByRole('link', { name: title, exact: true });
  }

  /** The value of one pipeline stage, or its skeleton while loading. */
  stat(stage: PipelineStage): Locator {
    return this.pipeline.getByRole('group', { name: stage, exact: true });
  }

  activityLink(text: string): Locator {
    return this.activity.getByRole('link', { name: text });
  }

  onboardingCard(heading: string): Locator {
    return this.page.getByRole('region', { name: heading });
  }

  async tryAgain(where: Locator = this.page.getByRole('main')): Promise<void> {
    await where.getByRole('button', { name: 'Try again' }).click();
  }
}
