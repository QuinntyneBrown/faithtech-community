import { expect, test } from '../../../e2e/fixtures/app';
import { AdminUsersPage } from '../../../e2e/pages/admin-users.page';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { EditProfilePage } from '../../../e2e/pages/edit-profile.page';
import { ProfilePage } from '../../../e2e/pages/profile.page';
import { Presenter } from '../presenter';

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
  api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo', roles: ['CityLead'] });
  api.addAccount({ email: 'victor@example.org', name: 'Victor Kane', suspended: true });
  api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson', verified: false });

  await show.card(
    'opening',
    'opening',
    ['Look after every account', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(priya),
  );

  await show.step('admin-link', async () => {
    await shell.navLink('Admin').click();
    await expect(users.heading).toHaveText('Admin');
  });

  await show.step(
    'all-users',
    async () => {
      await expect(users.row('Grace Okonkwo')).toContainText('City Lead');
      await expect(users.row('Victor Kane')).toContainText('Suspended');
      await expect(users.row('Leah Thompson')).toContainText('Unverified');
    },
    { poster: true },
  );

  await show.step('search', async () => {
    await users.searchFor('victor@');
    await expect(users.rows).toHaveCount(1);
    await users.searchFor('qwerty');
    await expect(users.noResults('qwerty')).toBeVisible();
    await users.clearSearch.click();
    await expect(users.rows).toHaveCount(4);
  });

  await show.step('open-profile', async () => {
    await users.profileLink('Grace Okonkwo').click();
    await expect(profile.heading).toHaveText('Grace Okonkwo');
    await expect(profile.editProfile).toBeVisible();
  });

  await show.step('override', async () => {
    await profile.editProfile.click();
    await expect(edit.adminNote).toBeVisible();
    await edit.fill({ bio: 'Leads the Toronto chapter.' });
    await edit.save.click();
    await expect(edit.savedToast).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'Every account in one list',
    'Search, open and correct any profile',
    'Each change is audited',
  ]);
  await show.finish();
});
