import { expect, test } from '../../../e2e/fixtures/app';
import { MockApi, MockPhoto } from '../../../e2e/fixtures/mock-api';
import { AdminUsersPage } from '../../../e2e/pages/admin-users.page';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { EditProfilePage } from '../../../e2e/pages/edit-profile.page';
import { ProfilePage } from '../../../e2e/pages/profile.page';
import { loadPicture, SCENE_ALT, Scene } from '../photos';
import { Presenter } from '../presenter';

/** A stored demo photo; the first is featured and newest, so it leads the strip. */
function photo(scene: Scene, n: number): MockPhoto {
  return {
    id: `${scene}-${n}`,
    url: loadPicture(scene).dataUrl,
    altText: SCENE_ALT[scene],
    isFeatured: n === 1,
    uploadedAt: `2026-10-0${9 - n}T10:00:00Z`,
  };
}

function givePhotos(api: MockApi, profileId: string, ...scenes: Scene[]): void {
  api.profiles.get(profileId)!.photos.push(...scenes.map((scene, i) => photo(scene, i + 1)));
}

// Journey: admin users and profile override (docs/detailed-designs/admin/admin-users-and-override, L2-040).
test('admin-users-and-override', async ({ page, api }) => {
  const show = await Presenter.start(page, 'admin-users-and-override');
  const shell = new AppShell(page);
  const users = new AdminUsersPage(page);
  const profile = new ProfilePage(page);
  const edit = new EditProfilePage(page);
  const priya = api.addAccount({
    email: 'priya@example.org',
    name: 'Priya Shah',
    roles: ['SystemAdmin'],
  });
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  const victor = api.addAccount({
    email: 'victor@example.org',
    name: 'Victor Kane',
    suspended: true,
  });
  const leah = api.addAccount({
    email: 'leah@example.org',
    name: 'Leah Thompson',
    verified: false,
  });
  const esther = api.addAccount({
    email: 'esther@example.org',
    name: 'Esther Nakamura',
    roles: ['Volunteer'],
  });
  givePhotos(api, priya.profileId, 'priya-shah');
  givePhotos(api, grace.profileId, 'grace-okonkwo', 'city');
  givePhotos(api, victor.profileId, 'victor-kane');
  givePhotos(api, leah.profileId, 'leah-thompson');
  givePhotos(api, esther.profileId, 'esther-nakamura');
  const graceProfile = api.profiles.get(grace.profileId)!;
  graceProfile.chapterId = api.chapters.named('Toronto').id;
  graceProfile.bio =
    'City Lead for Toronto. I host Builders Night and help new members find a project to join.';
  graceProfile.joinedAtUtc = '2024-03-12T10:00:00Z';
  // Esther lost City Lead but still owns her city's workspace (L2-037 AC2).
  api.agile.addWorkspace({ name: 'Austin city team', ownerId: esther.profileId });
  for (const [title, minutesAgo] of [
    ['Esther Nakamura no longer holds City Lead but owns Austin city team', 5],
    ['Victor Kane’s suspension was recorded in the audit log', 40],
    ['Grace Okonkwo published Builders Night', 90],
  ] as const) {
    api.notifications.add({ recipientId: priya.profileId, title }, minutesAgo);
  }

  await show.card(
    'opening',
    'opening',
    [
      'Look after every account',
      'Recorded against a local fake API · fictional people, demo photos',
    ],
    () => api.signInAs(priya),
  );

  await show.step('admin-link', async () => {
    await shell.openSection('Admin');
    await expect(users.heading).toHaveText('Admin');
  });

  await show.step(
    'all-users',
    async () => {
      await expect(users.row('Grace Okonkwo')).toContainText('City Lead');
      await expect(users.row('Victor Kane')).toContainText('Suspended');
      await expect(users.row('Leah Thompson')).toContainText('Unverified');
      await expect(users.photo('Grace Okonkwo')).toBeVisible();
      await expect(users.needsOwner).toContainText('Austin city team');
    },
    { poster: true },
  );

  await show.step('search', async () => {
    await users.searchFor('victor@');
    await expect(users.rows).toHaveCount(1);
    await users.searchFor('qwerty');
    await expect(users.noResults('qwerty')).toBeVisible();
    await users.clearSearch.click();
    await expect(users.rows).toHaveCount(5);
  });

  await show.step('open-profile', async () => {
    await users.profileLink('Grace Okonkwo').click();
    await expect(profile.heading).toHaveText('Grace Okonkwo');
    await expect(profile.editProfile).toBeVisible();
  });

  await show.step('override', async () => {
    await profile.editProfile.click();
    await expect(edit.adminNote).toBeVisible();
    await edit.fill({
      bio: 'City Lead for Toronto. I host Builders Night and pair new members with a project team.',
    });
    await edit.save.click();
    await expect(edit.savedToast).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0 }));
  });

  await show.card('closing', 'closing', [
    'Every account in one list',
    'Search, open and correct any profile',
    'Each change is audited',
  ]);
  await show.finish();
});
