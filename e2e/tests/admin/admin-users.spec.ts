// Traces to: L2-040, L2-039 (docs/detailed-designs/admin/admin-users-and-override, suspend-users)
import { expect, test } from '../../fixtures/app';
import { photoUrl } from '../../fixtures/mock-api';
import { AdminUsersPage } from '../../pages/admin-users.page';
import { AppShell } from '../../pages/app-shell.page';
import { SuspendUserDialog } from '../../pages/suspend-user.dialog';

test.describe('Admin users', () => {
  test('a System Admin searches every user and sees roles and status', async ({
    page,
    api,
    axe,
  }) => {
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo', roles: ['CityLead'] });
    api.addAccount({ email: 'victor@example.org', name: 'Victor Kane', suspended: true });
    api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson', verified: false });
    const users = new AdminUsersPage(page);
    await api.signInAs(priya, '/admin/users');

    await expect(users.heading).toHaveText('Admin');
    await expect(users.row('Grace Okonkwo')).toContainText('City Lead');
    await expect(users.row('Grace Okonkwo')).toContainText('Active');
    await expect(users.row('Victor Kane')).toContainText('Suspended');
    await expect(users.row('Leah Thompson')).toContainText('Unverified');
    await expect(users.profileLink('Grace Okonkwo')).toHaveAttribute('href', '/people/profile-2');
    await axe.check();

    await users.searchFor('victor@');
    await expect(users.rows).toHaveCount(1);
    await users.searchFor('qwerty');
    await expect(users.noResults('qwerty')).toBeVisible();
    await axe.check();
    await users.clearSearch.click();
    await expect(users.rows).toHaveCount(4);
  });

  // Traces to: L2-040 AC1
  test('a System Admin sees each member’s featured photo, and initials without one', async ({
    page,
    api,
  }) => {
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    api.profiles.get(grace.profileId)!.photos.push({
      id: 'photo-1',
      url: photoUrl('#0b7285'),
      altText: 'Grace at Builders Night',
      isFeatured: true,
      uploadedAt: '2026-10-01T09:00:00Z',
    });
    const users = new AdminUsersPage(page);
    await api.signInAs(priya, '/admin/users');

    await expect(users.photo('Grace Okonkwo')).toBeVisible();
    await expect(users.photo('Priya Shah')).toHaveCount(0);
    await expect(users.row('Priya Shah')).toContainText('PS');
  });

  test('a System Admin suspends a user with a reason and reinstates them', async ({
    page,
    api,
    axe,
  }) => {
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    const leah = api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson' });
    const users = new AdminUsersPage(page);
    await api.signInAs(priya, '/admin/users');

    await users.suspend('Leah Thompson').click();
    const dialog = new SuspendUserDialog(page, 'Leah Thompson');
    await expect(dialog.dialog).toBeVisible();
    await expect(dialog.reason).toBeFocused();
    await axe.check();
    await dialog.confirm.click();
    await expect(dialog.reasonError).toBeVisible();
    await dialog.reason.fill('Repeated spam event listings after a warning.');
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(users.row('Leah Thompson')).toContainText('Suspended');
    expect(api.callsTo('POST', `/api/admin/users/${leah.profileId}/suspension`)[0].body).toEqual({
      reason: 'Repeated spam event listings after a warning.',
    });
    expect(leah.suspended).toBe(true);

    await users.reinstate('Leah Thompson').click();
    await expect(users.row('Leah Thompson')).toContainText('Active');
    expect(leah.suspended).toBe(false);
  });

  test('anyone else sees that the area is for System Admins', async ({ page, api, axe }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const users = new AdminUsersPage(page);
    await api.signInAs(grace, '/admin/users');

    await expect(users.forbidden).toBeVisible();
    await axe.check();
  });

  test('members without System Admin get no Admin link', async ({ page, api }) => {
    const shell = new AppShell(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] }));

    await expect(shell.navLink('Home')).toBeVisible();
    expect(await shell.navLabels()).toContain('Announcements');
    expect(await shell.navLabels()).not.toContain('Admin');
  });

  test('a System Admin reaches the admin area from the Admin link', async ({ page, api }) => {
    const shell = new AppShell(page);
    await api.signInAs(
      api.addAccount({ email: 'priya@example.org', name: 'Priya Shah', roles: ['SystemAdmin'] }),
    );

    await shell.openSection('Admin');
    await expect(new AdminUsersPage(page).heading).toHaveText('Admin');
  });
});
