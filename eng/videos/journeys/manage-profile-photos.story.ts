import { expect, test } from '../../../e2e/fixtures/app';
import { DeletePhotoDialog } from '../../../e2e/pages/delete-photo.dialog';
import { EditProfilePage } from '../../../e2e/pages/edit-profile.page';
import { ProfilePage } from '../../../e2e/pages/profile.page';
import { loadPicture, SCENE_ALT } from '../photos';
import { Presenter, typeInto } from '../presenter';

// Journey: manage profile photos (docs/detailed-designs/profiles/manage-profile-photos, L2-007).
// The pictures are demo photos from the mocks; the fake API stores the uploaded picture as a data URL.
test('manage-profile-photos', async ({ page, api }) => {
  const show = await Presenter.start(page, 'manage-profile-photos');
  const profile = new ProfilePage(page);
  const edit = new EditProfilePage(page);
  const dialog = new DeletePhotoDialog(page);
  const leah = api.addAccount({ name: 'Leah Thompson', email: 'leah@example.org' });
  const portrait = loadPicture('leah-thompson');
  const city = loadPicture('city');
  const pictures = new Map([portrait, city].map((p) => [p.name, p.dataUrl]));
  api.uploadedPhotoUrl = (file) => pictures.get(file) ?? '';

  await show.card(
    'opening',
    'opening',
    ['Up to ten photos, each one described', 'Recorded against a local fake API · demo photos'],
    () => api.signInAs(leah, '/people/me/edit'),
  );

  await show.step(
    'add',
    async () => {
      await expect(edit.heading).toBeVisible();
      await edit.photosGroup.scrollIntoViewIfNeeded();
      await edit.choosePhotos([portrait, city]);
      await expect(edit.photoItems).toHaveCount(2);
      await expect(edit.photo(0)).toContainText('Not saved yet');
      await edit.photosGroup.evaluate((group) => group.scrollIntoView({ block: 'center' }));
    },
    { position: 'top' },
  );

  await show.step('describe-missing', async () => {
    await edit.save.click();
    await expect(edit.summary).toContainText('Describe this photo');
    expect(api.callsTo('POST', `/api/profiles/${leah.profileId}/photos`)).toHaveLength(0);
  });

  await show.step(
    'describe',
    async () => {
      await typeInto(edit.description(0), SCENE_ALT['leah-thompson']);
      await typeInto(edit.description(1), SCENE_ALT.city);
      await edit.save.click();
      await expect(edit.savedToast).toBeVisible();
      await expect(edit.photosGroup.getByText('Featured', { exact: true })).toHaveCount(1);
      expect(api.callsTo('POST', `/api/profiles/${leah.profileId}/photos`)).toHaveLength(2);
      await edit.photosGroup.evaluate((group) => group.scrollIntoView({ block: 'center' }));
    },
    { position: 'top' },
  );

  await show.step(
    'feature',
    async () => {
      const other = (await edit.photo(0).textContent())?.includes('Featured') ? 1 : 0;
      await edit.feature(other).click();
      await expect(edit.photo(other)).toContainText('Featured');
      await expect(edit.photosGroup.getByText('Featured', { exact: true })).toHaveCount(1);
    },
    { position: 'top', poster: true },
  );

  await show.step(
    'remove',
    async () => {
      const other = (await edit.photo(0).textContent())?.includes('Featured') ? 1 : 0;
      await edit.remove(other).click();
      await expect(dialog.dialog).toBeVisible();
      await page.waitForTimeout(2500);
      await dialog.confirm.click();
      await expect(dialog.dialog).toBeHidden();
      await expect(edit.photoItems).toHaveCount(1);
    },
    { position: 'top' },
  );

  await show.step('profile', async () => {
    await profile.open('me');
    await expect(profile.heading).toHaveText('Leah Thompson');
    await expect(profile.photos).toHaveCount(1);
    await expect
      .poll(() =>
        profile.avatarPhoto.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0),
      )
      .toBe(true);
  });

  await show.card('closing', 'closing', [
    'Up to ten photos on a profile',
    'Every photo has a description',
    'One featured photo, and removal only after you confirm',
  ]);
  await show.finish();
});
