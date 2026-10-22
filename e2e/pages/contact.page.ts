import { Locator, Page } from '@playwright/test';

/** One private contact at /contacts/:id (docs/mocks/pages/contact). */
export class ContactPage {
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly edit: Locator;
  readonly details: Locator;
  readonly notFound: Locator;
  readonly addNote: Locator;
  readonly archive: Locator;
  readonly matchAlert: Locator;
  readonly linkToProfile: Locator;
  readonly notThem: Locator;
  readonly linkedAlert: Locator;
  readonly notes: Locator;
  readonly photoFailedAlert: Locator;
  readonly photosSection: Locator;
  readonly photoCount: Locator;
  readonly addPhotos: Locator;
  readonly photoItems: Locator;
  readonly photoLimit: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('ft-page-header p');
    this.edit = page.getByRole('link', { name: 'Edit' });
    this.details = page.locator('ft-description-list');
    this.notFound = page.getByRole('heading', { name: 'We couldn’t find that contact' });
    this.addNote = page.getByRole('button', { name: 'Add note' });
    this.archive = page.getByRole('button', { name: 'Archive' });
    this.matchAlert = page.locator('ft-alert', { hasText: 'has joined FaithTech' });
    this.linkToProfile = page.getByRole('button', { name: 'Link to their profile' });
    this.notThem = page.getByRole('button', { name: 'Not them' });
    this.linkedAlert = page.locator('ft-alert', { hasText: 'member profile' });
    this.notes = page.locator('ft-note');
    this.photoFailedAlert = page.locator('ft-alert', { hasText: 'wasn’t added' });
    this.photosSection = page.getByRole('region', { name: /^Photos/ });
    this.photoCount = this.photosSection.locator('ft-badge').first();
    this.addPhotos = this.photosSection.getByRole('button', { name: 'Add photos' });
    this.photoItems = this.photosSection.getByRole('listitem');
    this.photoLimit = this.photosSection.getByText(
      'That’s 10 photos, the most a contact can have. Delete one to add another.',
    );
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/contacts/${id}`);
  }

  /** A photo in the Photos section, by its description. */
  photo(altText: string): Locator {
    return this.photoItems.filter({
      has: this.page.getByRole('img', { name: altText, exact: true }),
    });
  }

  /** The description of the photo marked Featured. */
  featuredPhoto(): Locator {
    return this.photoItems.filter({ has: this.page.getByText('Featured', { exact: true }) });
  }

  feature(index: number): Locator {
    return this.photosSection.getByRole('button', { name: `Feature photo ${index + 1}` });
  }

  editDescription(index: number): Locator {
    return this.photosSection.getByRole('button', {
      name: `Edit description of photo ${index + 1}`,
    });
  }

  deletePhoto(index: number): Locator {
    return this.photosSection.getByRole('button', { name: `Delete photo ${index + 1}` });
  }

  detail(label: string): Locator {
    return this.page
      .locator('dl', { has: this.page.getByText(label, { exact: true }) })
      .locator('dd');
  }
}
