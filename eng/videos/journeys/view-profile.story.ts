import { expect, test } from '../../../e2e/fixtures/app';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { ProfilePage } from '../../../e2e/pages/profile.page';
import { loadPicture, SCENE_ALT } from '../photos';
import { Presenter } from '../presenter';

// Journey: view profiles (docs/detailed-designs/profiles/view-profile, L2-005, L2-007).
test('view-profile', async ({ page, api }) => {
  const show = await Presenter.start(page, 'view-profile');
  const shell = new AppShell(page);
  const profile = new ProfilePage(page);
  const leah = api.addAccount({ name: 'Leah Thompson', email: 'leah@example.org' });
  const [portrait, pairing, whiteboard] = [
    loadPicture('samuel-mensah'),
    loadPicture('hackathon-pairing'),
    loadPicture('whiteboard-talk'),
  ];
  api.addProfile({
    id: 'samuel',
    name: 'Samuel Mensah',
    homeCity: 'Toronto',
    bio: 'Backend engineer who loves helping new builders ship their first project.',
    roles: ['CityLead', 'ProductEngineer'],
    photos: [
      {
        id: 'p1',
        url: portrait.dataUrl,
        altText: SCENE_ALT['samuel-mensah'],
        isFeatured: true,
        uploadedAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'p2',
        url: pairing.dataUrl,
        altText: SCENE_ALT['hackathon-pairing'],
        isFeatured: false,
        uploadedAt: '2026-10-05T10:00:00Z',
      },
      {
        id: 'p3',
        url: whiteboard.dataUrl,
        altText: SCENE_ALT['whiteboard-talk'],
        isFeatured: false,
        uploadedAt: '2026-10-09T10:00:00Z',
      },
    ],
  });

  await show.card(
    'opening',
    'opening',
    [
      'See who is in the community',
      'Recorded against a local fake API · fictional people, demo photos',
    ],
    () => api.signInAs(leah),
  );

  await show.step('own-profile', async () => {
    await shell.openYourProfile('Leah Thompson');
    await expect(profile.heading).toHaveText('Leah Thompson');
    await expect(profile.editProfile).toBeVisible();
    await expect(profile.noPhotos).toBeVisible();
  });

  await show.step(
    'other-profile',
    async () => {
      await profile.open('samuel');
      await expect(profile.heading).toHaveText('Samuel Mensah');
      await expect(profile.roles).toHaveText(['City Lead', 'Product Engineer']);
      await expect(profile.where('Toronto')).toBeVisible();
      await expect(profile.avatarPhoto).toBeVisible();
      expect(
        await profile.avatarPhoto.evaluate((img: HTMLImageElement) => img.naturalWidth),
      ).toBeGreaterThan(0);
    },
    { poster: true },
  );

  await show.step('photos', async () => {
    await expect(profile.photos).toHaveCount(3);
    await profile.photos.last().scrollIntoViewIfNeeded();
    for (const img of await profile.photos.all()) {
      await expect
        .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
        .toBe(true);
    }
    await expect(profile.editProfile).toHaveCount(0);
  });

  await show.step('not-found', async () => {
    await profile.open('contact-tomas');
    await expect(profile.notFound).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'Profiles are for signed-in members only',
    'Name, roles, home city, bio and photos',
    'Nothing shown that you may not see',
  ]);
  await show.finish();
});
