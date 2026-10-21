import { Locator, Page } from '@playwright/test';

/** A member's profile at /people/:id or /people/me (docs/mocks/pages/profile). */
export class ProfilePage {
  readonly heading: Locator;
  readonly roles: Locator;
  readonly bio: Locator;
  readonly photos: Locator;
  readonly photosHeading: Locator;
  readonly avatarPhoto: Locator;
  /** The initials circle shown when there is no featured photo. */
  readonly avatar: Locator;
  readonly editProfile: Locator;
  readonly noPhotos: Locator;
  readonly addPhotos: Locator;
  readonly loading: Locator;
  readonly loadError: Locator;
  readonly tryAgain: Locator;
  readonly notFound: Locator;
  readonly addRole: Locator;
  readonly removeRole: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.roles = page.locator('ft-profile-header .ft-badge--role');
    this.bio = page.locator('.ft-profile-header__bio');
    this.photos = page.getByRole('region', { name: 'Photos' }).getByRole('img');
    this.photosHeading = page.getByRole('heading', { name: 'Photos', level: 2 });
    this.avatarPhoto = page.locator('.ft-profile-header__head ft-avatar img');
    this.avatar = page.locator('.ft-profile-header__head .ft-avatar');
    this.editProfile = page.getByRole('link', { name: 'Edit profile' });
    this.noPhotos = page.getByRole('heading', { name: 'No photos yet' });
    this.addPhotos = page.getByRole('link', { name: 'Add photos' });
    this.loading = page.locator('[aria-busy="true"][aria-label="Loading profile"]');
    this.loadError = page.getByRole('heading', { name: 'We couldn’t load this profile' });
    this.tryAgain = page.getByRole('button', { name: 'Try again' });
    this.notFound = page.getByRole('heading', { name: 'We can’t find that profile' });
    this.addRole = page.getByRole('button', { name: 'Add a role' });
    this.removeRole = page.getByRole('button', { name: 'Remove a role' });
  }

  async open(id: string): Promise<void> {
    await this.page.goto(`/people/${id}`);
  }

  where(text: string): Locator {
    return this.page.locator('.ft-profile-header__where', { hasText: text });
  }
}
