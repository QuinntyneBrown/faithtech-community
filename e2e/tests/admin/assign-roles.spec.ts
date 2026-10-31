// Traces to: L2-008, L2-009, L2-137 AC4-AC5, L2-138 AC1-AC4 (docs/detailed-designs/admin/assign-roles)
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
    // Focus starts on the first role, the dialog's only field.
    await expect(dialog.options.first()).toBeFocused();
    await expect(dialog.options).toHaveCount(4);
    await expect(dialog.option('City Lead')).toHaveCount(0);
    await expect(dialog.option('Staff')).toHaveCount(0);
    await expect(dialog.caption).toHaveText(
      'These are the roles your City Lead role may grant. An administrator can grant any role.',
    );
    await axe.check();
    await dialog.confirm.click();
    await expect(dialog.choiceError).toBeVisible();
    await dialog.option('Volunteer').check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(profile.roles).toHaveText(['Volunteer', 'Product Engineer', 'Attendee']);
    expect(api.callsTo('POST', '/api/profiles/jonah/roles')[0].body).toEqual({
      roleId: api.roleId('Volunteer'),
    });
  });

  test('a System Admin is offered every role and told the owner is not notified', async ({
    page,
    api,
  }) => {
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    api.addProfile({ id: 'jonah', name: 'Jonah Bell', roles: ['Attendee'] });
    const profile = new ProfilePage(page);
    await api.signInAs(priya, '/people/jonah');

    await profile.addRole.click();
    const dialog = new RoleDialog(page, 'Add a role for Jonah Bell');
    await expect(dialog.options).toHaveCount(8);
    await expect(dialog.caption).toHaveText(
      'As an administrator you can grant any role. The change is recorded in the audit log, and Jonah isn’t notified.',
    );
    await dialog.option('Staff').check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(profile.roles).toHaveText(['Staff', 'Attendee']);
  });

  test('a grantor of a test-defined organisation is offered exactly the roles their rule names', async ({
    page,
    api,
    axe,
  }) => {
    api.defineRole({ key: 'Helper', name: 'Helper', description: 'Helps on the day' });
    api.defineRole({ key: 'Guest', name: 'Guest' });
    api.defineRole({
      key: 'Coordinator',
      name: 'Coordinator',
      capabilities: ['AssignRoles', 'ViewPeopleDirectory'],
      grants: ['Helper'],
    });
    const cora = api.addAccount({ email: 'cora@example.org', roles: ['Coordinator'] });
    api.addProfile({ id: 'jonah', name: 'Jonah Bell', roles: ['Guest'] });
    const profile = new ProfilePage(page);
    await api.signInAs(cora, '/people/jonah');

    await expect(profile.removeRole).toHaveCount(0);
    await profile.addRole.click();
    const dialog = new RoleDialog(page, 'Add a role for Jonah Bell');
    await expect(dialog.options).toHaveCount(1);
    await expect(dialog.dialog).toContainText('Helps on the day');
    await expect(dialog.caption).toHaveText(
      'These are the roles your Coordinator role may grant. An administrator can grant any role.',
    );
    await axe.check();
    await dialog.option('Helper').check();
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(profile.roles).toHaveText(['Helper', 'Guest']);
  });

  test('a City Lead removes a role', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addProfile({ id: 'ruth', name: 'Ruth Alvarez', roles: ['Volunteer'] });
    const profile = new ProfilePage(page);
    await api.signInAs(grace, '/people/ruth');

    await profile.removeRole.click();
    const dialog = new RoleDialog(page, 'Remove Volunteer from Ruth Alvarez?');
    await expect(dialog.cancel).toBeFocused();
    await expect(dialog.options).toHaveCount(0);
    await dialog.confirm.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(page.getByText('No role yet')).toBeVisible();
  });

  test('members without AssignRoles are offered no role changes', async ({ page, api }) => {
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

    await expect(dialog.refusal).toContainText('There must always be at least one administrator.');
    await expect(dialog.dialog).toBeVisible();
  });
});
