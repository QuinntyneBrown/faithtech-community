// Traces to: L2-007 (docs/detailed-designs/profiles/manage-profile-photos)
import { expect, test } from '../../fixtures/app';
import { MockApi, MockPhoto, photoUrl } from '../../fixtures/mock-api';
import { DeletePhotoDialog } from '../../pages/delete-photo.dialog';
import { EditProfilePage } from '../../pages/edit-profile.page';
import { ProfilePage } from '../../pages/profile.page';

// A real 1×1 PNG, so the browser can preview what the member chose.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const image = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG });

test.describe('Manage profile photos', () => {
  test('a photo with a description uploads on save and is shown on the profile', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.choosePhotos([image('builders-night.png')]);
    await expect(edit.photo(0)).toContainText('Not saved yet');
    await axe.check();
    await edit.description(0).fill('Grace speaking at Builders Night');
    await edit.save.click();

    await expect(edit.savedToast).toBeVisible();
    const upload = api.callsTo('POST', `/api/profiles/${grace.profileId}/photos`)[0];
    expect(upload.body).toEqual({
      file: 'builders-night.png',
      altText: 'Grace speaking at Builders Night',
    });
    await expect(edit.photo(0)).toContainText('Featured');
    await expect(edit.photo(0)).not.toContainText('Not saved yet');

    const profile = new ProfilePage(page);
    await profile.open('me');
    await expect(profile.photos).toHaveCount(1);
    await expect(profile.photos.first()).toHaveAttribute('alt', 'Grace speaking at Builders Night');
    await expect(profile.avatarPhoto).toBeVisible();
  });

  test('a photo without a description blocks the save with "Describe this photo"', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.choosePhotos([image('team.png')]);
    await edit.save.click();

    await expect(edit.summary).toContainText('Describe this photo');
    await expect(edit.photo(0)).toContainText(
      'Describe what’s in the photo for people using screen readers.',
    );
    expect(api.callsTo('PUT', `/api/profiles/${grace.profileId}`)).toHaveLength(0);
    expect(api.callsTo('POST', `/api/profiles/${grace.profileId}/photos`)).toHaveLength(0);
    await axe.check();

    await edit.summary.getByRole('link', { name: 'Describe this photo' }).click();
    await expect(edit.description(0)).toBeFocused();
  });

  test('a file over 5 MB or of another type is refused before it is added', async ({
    page,
    api,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.choosePhotos([
      { name: 'team.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(6 * 1024 * 1024) },
      { name: 'party.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') },
    ]);

    await expect(
      edit.note('team.jpg is 6.0 MB. Photos can be up to 5 MB — try a smaller one.'),
    ).toBeVisible();
    await expect(
      edit.note('party.gif isn’t a photo we can use. Photos must be JPEG, PNG or WebP.'),
    ).toBeVisible();
    await expect(edit.photoItems).toHaveCount(0);
  });

  test('a file the server refuses shows its reason on that photo', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    api.on('POST', `/api/profiles/${grace.profileId}/photos`, (route) =>
      route.fulfill({
        status: 400,
        json: {
          status: 400,
          errors: {
            File: ['fake.png isn’t really a PNG image. Choose a JPEG, PNG or WebP photo.'],
          },
        },
      }),
    );
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.choosePhotos([image('fake.png')]);
    await edit.description(0).fill('Not really a photo');
    await edit.save.click();

    await expect(edit.photo(0)).toContainText(
      'fake.png isn’t really a PNG image. Choose a JPEG, PNG or WebP photo.',
    );
    await expect(edit.savedToast).toHaveCount(0);
  });

  test('at 10 photos Add photos is disabled and explains the limit', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    withPhotos(api, grace.profileId, 10);
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await expect(edit.addPhotos).toBeDisabled();
    await expect(edit.photoLimit).toBeVisible();
    await expect(edit.addPhotos).toHaveAttribute('aria-describedby', /.+/);
    await axe.check();
  });

  test('featuring a photo makes it the only featured photo', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    withPhotos(api, grace.profileId, 3);
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.feature(1).click();

    await expect(edit.photo(1)).toContainText('Featured');
    await expect(edit.photosGroup.getByText('Featured', { exact: true })).toHaveCount(1);
    expect(
      api.callsTo('PUT', `/api/profiles/${grace.profileId}/photos/photo-b/featured`),
    ).toHaveLength(1);
  });

  test('deleting the featured photo after confirmation features the newest remaining photo', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    withPhotos(api, grace.profileId, 3, 'photo-a');
    const edit = new EditProfilePage(page);
    const dialog = new DeletePhotoDialog(page);
    await api.signInAs(grace, '/people/me/edit');

    // Newest first: photo-c, photo-b, then the featured photo-a.
    await edit.remove(2).click();
    await expect(dialog.dialog).toBeVisible();
    await expect(dialog.description).toHaveText('“Photo a” will be removed from your profile.');
    await expect(dialog.cancel).toBeFocused();
    await axe.check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(edit.photoItems).toHaveCount(2);
    await expect(edit.photo(0)).toContainText('Featured');
    expect(api.callsTo('DELETE', `/api/profiles/${grace.profileId}/photos/photo-a`)).toHaveLength(
      1,
    );
  });

  test('the delete dialog is busy while deleting and keeps the photo when it fails', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    withPhotos(api, grace.profileId, 2);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    api.on('DELETE', `/api/profiles/${grace.profileId}/photos/photo-b`, async (route) => {
      await held;
      await route.fulfill({ status: 503 });
    });
    const edit = new EditProfilePage(page);
    const dialog = new DeletePhotoDialog(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.remove(0).click();
    await dialog.confirm.click();

    await expect(dialog.confirm).toHaveAttribute('aria-busy', 'true');
    await expect(dialog.cancel).toBeDisabled();
    release();
    await expect(dialog.failure).toBeVisible();
    await axe.check();
    await dialog.cancel.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(edit.photoItems).toHaveCount(2);
    await expect(edit.remove(0)).toBeFocused();
  });

  test('a pending photo is removed without a confirmation', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.choosePhotos([image('oops.png')]);
    await edit.remove(0).click();

    await expect(edit.photoItems).toHaveCount(0);
    await expect(new DeletePhotoDialog(page).dialog).toHaveCount(0);
  });

  test('a changed description is saved with the profile', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org' });
    withPhotos(api, grace.profileId, 1);
    const edit = new EditProfilePage(page);
    await api.signInAs(grace, '/people/me/edit');

    await edit.description(0).fill('Grace at the spring hackathon');
    await edit.save.click();

    await expect(edit.savedToast).toBeVisible();
    expect(api.callsTo('PUT', `/api/profiles/${grace.profileId}/photos/photo-a`)[0].body).toEqual({
      altText: 'Grace at the spring hackathon',
    });
  });
});

/** Saved photos photo-a, photo-b, … uploaded a day apart (photo-a oldest), with one featured. */
function withPhotos(api: MockApi, profileId: string, count: number, featured = 'photo-a'): void {
  const photos: MockPhoto[] = Array.from({ length: count }, (_, i) => {
    const letter = String.fromCharCode(97 + i);
    return {
      id: `photo-${letter}`,
      url: photoUrl(),
      altText: `Photo ${letter}`,
      isFeatured: `photo-${letter}` === featured,
      uploadedAt: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    };
  });
  api.profiles.get(profileId)!.photos = photos;
}
