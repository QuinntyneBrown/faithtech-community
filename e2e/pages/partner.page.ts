import { Locator, Page } from '@playwright/test';

/** One partner at /partners/:id (docs/mocks/pages/partner). */
export class PartnerPage {
  readonly heading: Locator;
  readonly stage: Locator;
  readonly subtitle: Locator;
  readonly edit: Locator;
  readonly moveStage: Locator;
  readonly logActivity: Locator;
  /** The shared activity timeline, newest first (L2-086). */
  readonly timeline: Locator;
  readonly entries: Locator;
  /** The type chips: All, Calls, Emails, Meetings, Notes, Stage moves. */
  readonly filters: Locator;
  readonly showOlder: Locator;
  /** "No touchpoints yet" when the selected type has no logged entries. */
  readonly empty: Locator;
  /** "1 call. Show all activity" under a filtered timeline. */
  readonly filteredCaption: Locator;
  readonly showAll: Locator;
  /** The empty state's own Log activity button. */
  readonly emptyLogActivity: Locator;
  readonly timelineError: Locator;
  /** "This may be the same partner as “{other}”" (L2-088). */
  readonly duplicateAlert: Locator;
  readonly compareAndMerge: Locator;
  readonly notTheSame: Locator;
  /** "{name} was merged into {kept}" on an archived partner (L2-089 AC7). */
  readonly archivedAlert: Locator;
  /** System Admin only, on an archived partner (L2-090 AC4). */
  readonly restore: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.stage = page.locator('ft-page-header ft-badge');
    this.subtitle = page.locator('[ftPageHeaderSubtitle]');
    this.edit = page.getByRole('link', { name: 'Edit' });
    this.moveStage = page.getByRole('button', { name: 'Move stage' });
    this.logActivity = page.locator('ft-page-header').getByRole('button', { name: 'Log activity' });
    this.timeline = page.getByRole('list', { name: 'Activity' });
    this.entries = this.timeline.getByRole('listitem');
    this.filters = page.getByRole('group', { name: 'Show' });
    this.showOlder = page.getByRole('button', { name: 'Show older' });
    this.empty = page.getByRole('heading', { name: 'No touchpoints yet' });
    this.filteredCaption = page.getByRole('paragraph').filter({ hasText: 'Show all activity' });
    this.showAll = page.getByRole('link', { name: 'Show all activity' });
    this.emptyLogActivity = page
      .locator('ft-empty-state')
      .getByRole('button', { name: 'Log activity' });
    this.timelineError = page
      .getByRole('alert')
      .filter({ hasText: 'We couldn’t load the activity' });
    this.duplicateAlert = page
      .getByRole('status')
      .filter({ hasText: 'This may be the same partner as' });
    this.compareAndMerge = this.duplicateAlert.getByRole('button', { name: 'Compare and merge' });
    this.notTheSame = this.duplicateAlert.getByRole('button', { name: 'Not the same' });
    this.archivedAlert = page.getByRole('status').filter({ hasText: 'was merged into' });
    this.restore = page.locator('ft-page-header').getByRole('button', { name: 'Restore' });
  }

  /** The archived alert's "Open {kept}" link. */
  openKept(name: string): Locator {
    return this.archivedAlert.getByRole('link', { name: `Open ${name}` });
  }

  /** The duplicate alert's "Open {other}" link. */
  openDuplicate(name: string): Locator {
    return this.duplicateAlert.getByRole('link', { name: `Open ${name}` });
  }

  filter(name: string): Locator {
    return this.filters.getByRole('button', { name, exact: true });
  }

  /** The entry's type, as its bold label says it: Call, Stage moved, Added to the pipeline... */
  entryTypes(): Promise<string[]> {
    return this.entries.locator('strong').allTextContents();
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/partners/${id}`);
  }

  detail(label: string): Locator {
    return this.page
      .locator('dl', { has: this.page.getByText(label, { exact: true }) })
      .locator('dd');
  }
}
