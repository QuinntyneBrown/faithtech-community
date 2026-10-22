import { expect, test } from '../../../e2e/fixtures/app';
import { ProfilePage } from '../../../e2e/pages/profile.page';
import { RoleDialog } from '../../../e2e/pages/role.dialog';
import { Presenter } from '../presenter';

// Journey: assign roles (docs/detailed-designs/admin/assign-roles, L2-008, L2-009).
test('assign-roles', async ({ page, api }) => {
  const show = await Presenter.start(page, 'assign-roles');
  const profile = new ProfilePage(page);
  const grace = api.addAccount({
    email: 'grace@example.org',
    name: 'Grace Okonkwo',
    roles: ['CityLead'],
  });
  api.addProfile({ id: 'jonah', name: 'Jonah Bell', roles: ['ProductEngineer', 'Attendee'] });
  api.addProfile({ id: 'ruth', name: 'Ruth Alvarez', roles: ['Volunteer'] });

  await show.card(
    'opening',
    'opening',
    ['Give people the right roles', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(grace, '/people/jonah'),
  );

  await show.step('profile', async () => {
    await expect(profile.heading).toHaveText('Jonah Bell');
    await expect(profile.roles).toHaveText(['Product Engineer', 'Attendee']);
    await expect(profile.addRole).toBeVisible();
  });

  const add = new RoleDialog(page, 'Add a role for Jonah Bell');
  await show.step('add-dialog', async () => {
    await profile.addRole.click();
    await expect(add.dialog).toBeVisible();
    await expect(add.options).toHaveCount(4);
    await expect(add.option('City Lead')).toHaveCount(0);
    await expect(add.caption).toBeVisible();
  });

  await show.step(
    'choose',
    async () => {
      await add.confirm.click();
      await expect(add.choiceError).toBeVisible();
      await add.option('Volunteer').check();
      await add.confirm.click();
      await expect(add.dialog).toBeHidden();
      await expect(profile.roles).toHaveText(['Product Engineer', 'Attendee', 'Volunteer']);
    },
    { poster: true },
  );

  await show.step('remove', async () => {
    await profile.open('ruth');
    await profile.removeRole.click();
    const remove = new RoleDialog(page, 'Remove Volunteer from Ruth Alvarez?');
    await expect(remove.cancel).toBeFocused();
    await remove.confirm.click();
    await expect(remove.dialog).toBeHidden();
    await expect(page.getByText('No role yet')).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'City Leads add and remove everyday roles',
    'City Lead, Staff and System Admin are for System Admins only',
  ]);
  await show.finish();
});
