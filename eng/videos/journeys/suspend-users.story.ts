import { expect, test } from '../../../e2e/fixtures/app';
import { AdminUsersPage } from '../../../e2e/pages/admin-users.page';
import { SuspendUserDialog } from '../../../e2e/pages/suspend-user.dialog';
import { Presenter } from '../presenter';

// Journey: suspend and reinstate users (docs/detailed-designs/admin/suspend-users, L2-039).
test('suspend-users', async ({ page, api }) => {
  const show = await Presenter.start(page, 'suspend-users');
  const users = new AdminUsersPage(page);
  const priya = api.addAccount({
    email: 'priya@example.org',
    name: 'Priya Shah',
    roles: ['SystemAdmin'],
  });
  api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson' });
  api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo', roles: ['CityLead'] });
  const dialog = new SuspendUserDialog(page, 'Leah Thompson');

  await show.card(
    'opening',
    'opening',
    ['Suspend and reinstate accounts', 'Recorded against a local fake API · synthetic people'],
    () => api.signInAs(priya, '/admin/users'),
  );

  await show.step('list', async () => {
    await expect(users.row('Leah Thompson')).toContainText('Active');
    await expect(users.suspend('Leah Thompson')).toBeVisible();
  });

  await show.step('dialog', async () => {
    await users.suspend('Leah Thompson').click();
    await expect(dialog.dialog).toBeVisible();
    await expect(dialog.reason).toBeFocused();
  });

  await show.step('reason-required', async () => {
    await dialog.confirm.click();
    await expect(dialog.reasonError).toBeVisible();
  });

  await show.step(
    'suspend',
    async () => {
      await dialog.reason.fill('Repeated spam event listings after a warning.');
      await dialog.confirm.click();
      await expect(dialog.dialog).toBeHidden();
      await expect(users.row('Leah Thompson')).toContainText('Suspended');
    },
    { poster: true },
  );

  await show.step('reinstate', async () => {
    await users.reinstate('Leah Thompson').click();
    await expect(users.row('Leah Thompson')).toContainText('Active');
  });

  await show.card('closing', 'closing', [
    'Suspension needs a reason',
    'Reinstating is one click',
    'Both are in the audit log',
  ]);
  await show.finish();
});
