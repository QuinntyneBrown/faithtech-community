// Traces to: L2-044 AC3 (docs/detailed-designs/platform/accessibility: field errors are announced
// through a polite live region; forms that move focus to their errors announce them by focus).
import { expect, test } from '../../fixtures/app';
import { isAnnounced } from '../../pages/accessibility-tree';
import { AdminUsersPage } from '../../pages/admin-users.page';
import { InvitesPage } from '../../pages/invites.page';
import { ProfilePage } from '../../pages/profile.page';
import { RoleDialog } from '../../pages/role.dialog';
import { SendInviteDialog } from '../../pages/send-invite.dialog';
import { SuspendUserDialog } from '../../pages/suspend-user.dialog';
import { VerifyEmailPage } from '../../pages/verify-email.page';

test.describe('Announced field errors', () => {
  test('Send invite announces the email error while focus stays on Send invite', async ({
    page,
    api,
    axe,
  }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    const invites = new InvitesPage(page);
    await api.signInAs(grace, '/invites');
    await invites.inviteSomeone.click();
    const dialog = new SendInviteDialog(page);

    await dialog.send.focus();
    await page.keyboard.press('Enter');

    await expect(dialog.emailError).toBeVisible();
    await expect(dialog.send).toBeFocused();
    expect(await isAnnounced(dialog.emailError)).toBe(true);
    await axe.check();

    // Fixed and retried: the error leaves the live region, so nothing stale is announced.
    await dialog.email.fill('nate.oyelaran@example.org');
    await dialog.send.click();
    await expect(dialog.dialog).toBeHidden();
  });

  test('Add role announces that a role must be chosen', async ({ page, api }) => {
    const grace = api.addAccount({ email: 'grace@example.org', roles: ['CityLead'] });
    api.addProfile({ id: 'jonah', name: 'Jonah Bell', roles: ['Attendee'] });
    const profile = new ProfilePage(page);
    await api.signInAs(grace, '/people/jonah');
    await profile.addRole.click();
    const dialog = new RoleDialog(page, 'Add a role for Jonah Bell');

    await dialog.confirm.click();

    await expect(dialog.choiceError).toBeVisible();
    expect(await isAnnounced(dialog.choiceError)).toBe(true);
  });

  test('Suspend announces that a reason is needed', async ({ page, api }) => {
    const priya = api.addAccount({
      email: 'priya@example.org',
      name: 'Priya Shah',
      roles: ['SystemAdmin'],
    });
    api.addAccount({ email: 'leah@example.org', name: 'Leah Thompson' });
    const users = new AdminUsersPage(page);
    await api.signInAs(priya, '/admin/users');
    await users.suspend('Leah Thompson').click();
    const dialog = new SuspendUserDialog(page, 'Leah Thompson');

    await dialog.confirm.click();

    await expect(dialog.reasonError).toBeVisible();
    expect(await isAnnounced(dialog.reasonError)).toBe(true);
  });

  test('sending a new verification link announces a missing email', async ({ page, api }) => {
    api.on('POST', '/api/account/verify-email', (route) =>
      route.fulfill({
        status: 400,
        json: {
          status: 400,
          errors: { Token: ['This link has expired or has already been used.'] },
        },
      }),
    );
    const verify = new VerifyEmailPage(page);
    await verify.openLink('user-1', 'old-token');
    await expect(verify.expired).toBeVisible();

    await verify.sendNewLink.click();

    const error = verify.emailError;
    await expect(error).toBeVisible();
    expect(await isAnnounced(error)).toBe(true);
  });
});
