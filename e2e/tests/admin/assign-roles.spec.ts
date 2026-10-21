// Traces to: L2-008, L2-009 (docs/detailed-designs/admin/assign-roles)
import { expect, test } from '../../fixtures/app';
import { ProfilePage } from '../../pages/profile.page';
import { RoleDialog } from '../../pages/role.dialog';

test.describe('Assign roles', () => {
  test('a City Lead adds a role they may grant and the badges update without a reload', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addProfile({ id: 'jonah', name: 'Jonah Bell', roles: ['ProductEngineer', 'Attendee'] });
    const profile = new ProfilePage(page);
    await api.signInAs(grace, '/people/jonah');

    await profile.addRole.click();
    const dialog = new RoleDialog(page, 'Add a role for Jonah Bell');
    await expect(dialog.options).toHaveCount(4);
    await expect(dialog.option('City Lead')).toHaveCount(0);
    await expect(dialog.option('Staff')).toHaveCount(0);
    await expect(dialog.caption).toBeVisible();
    await axe.check();
    await dialog.confirm.click();
    await expect(dialog.choiceError).toBeVisible();
    await dialog.option('Volunteer').check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(profile.roles).toHaveText(['Product Engineer', 'Attendee', 'Volunteer']);
    expect(api.callsTo('POST', '/api/profiles/jonah/roles')[0].body).toEqual({ role: 'Volunteer' });
  });

  test('a City Lead removes a role', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addProfile({ id: 'ruth', name: 'Ruth Alvarez', roles: ['Volunteer'] });
    const profile = new ProfilePage(page);
    await api.signInAs(grace, '/people/ruth');

    await profile.removeRole.click();
    const dialog = new RoleDialog(page, 'Remove Volunteer from Ruth Alvarez?');
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(page.getByText('No role yet')).toBeVisible();
  });

  test('members without City Lead or System Admin are offered no role changes', async ({
    page,
    api,
  }) => {
    const marcus = api.addAccount({ email: 'marcus@example.org', roles: ['EventLead'] });
    api.addProfile({ id: 'ruth', name: 'Ruth Alvarez', roles: ['Volunteer'] });
    const profile = new ProfilePage(page);
    await api.signInAs(marcus, '/people/ruth');

    await expect(profile.heading).toHaveText('Ruth Alvarez');
    await expect(profile.addRole).toHaveCount(0);
    await expect(profile.removeRole).toHaveCount(0);
  });

  test('the last System Admin role cannot be removed', async ({ page, api }) => {
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    const profile = new ProfilePage(page);
    await api.signInAs(priya, '/people/me');

    await profile.removeRole.click();
    const dialog = new RoleDialog(page, 'Remove System Admin from Priya Shah?');
    await dialog.confirm.click();

    await expect(dialog.refusal).toContainText('There must always be at least one System Admin.');
    await expect(dialog.dialog).toBeVisible();
  });
});
