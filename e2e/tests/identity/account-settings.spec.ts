import { expect, test } from '../../fixtures/app';
import { SettingsPage } from '../../pages/settings.page';
import { SignInPage } from '../../pages/sign-in.page';
import { SignOutEverywhereDialog } from '../../pages/sign-out-everywhere.dialog';
import { VerifyEmailPage } from '../../pages/verify-email.page';

// L2-052: account settings (docs/detailed-designs/identity/account-settings).
test.describe('Account settings', () => {
  // AC1: the new address must be verified before it replaces the old one.
  test('a new email is confirmed from the link sent to it before it replaces the old one', async ({
    page,
    api,
    axe,
  }) => {
    const settings = new SettingsPage(page);
    const grace = api.addAccount({ email: 'grace@example.org', name: 'Grace Okonkwo' });
    await api.signInAs(grace, '/settings');

    await expect(settings.email).toHaveValue('grace@example.org');
    await axe.check();
    await settings.email.fill('grace.okonkwo@example.org');
    await settings.saveSettings.click();

    await expect(
      settings.accountSaved('We sent a link to grace.okonkwo@example.org'),
    ).toBeVisible();
    await expect(settings.email).toHaveValue('grace@example.org');

    const verify = new VerifyEmailPage(page);
    await verify.openEmailChangeLink(api.emailChangeLinks.get('grace.okonkwo@example.org')!);
    await expect(verify.emailChanged).toBeVisible();
    await expect(
      page.getByText('Sign in with grace.okonkwo@example.org from now on.'),
    ).toBeVisible();
    await axe.check();

    await settings.open();
    await expect(settings.email).toHaveValue('grace.okonkwo@example.org');
  });

  test('a used email-change link says so and points back to Settings', async ({ page, api }) => {
    const settings = new SettingsPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');
    await settings.email.fill('grace.okonkwo@example.org');
    await settings.saveSettings.click();
    await expect(settings.accountSaved('We sent a link')).toBeVisible();
    const link = api.emailChangeLinks.get('grace.okonkwo@example.org')!;
    const verify = new VerifyEmailPage(page);
    await verify.openEmailChangeLink(link);
    await expect(verify.emailChanged).toBeVisible();

    await verify.openEmailChangeLink(link);

    await expect(verify.expired).toBeVisible();
    await expect(verify.emailChangeExpired).toBeVisible();
    await expect(verify.openSettings).toHaveAttribute('href', '/settings');
  });

  test('an email another account uses is refused on the Email field', async ({ page, api }) => {
    const settings = new SettingsPage(page);
    api.addAccount({ email: 'leah@example.org' });
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');

    await settings.email.fill('leah@example.org');
    await settings.saveSettings.click();

    await expect(settings.errorSummary()).toContainText('Fix 1 thing to save');
    await expect(settings.fieldError('Email')).toHaveText('Another account uses that email.');
  });

  // AC2: the current password is required, and the new one follows L2-001.3.
  test('a new password needs the current one', async ({ page, api, axe }) => {
    const settings = new SettingsPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');

    await settings.newPassword.fill('kestrel-labs-2026');
    await settings.saveSettings.click();

    await expect(settings.errorSummary()).toContainText('Enter your current password');
    await expect(settings.fieldError('Current password')).toHaveText(
      'Enter your current password to change it.',
    );
    await expect(settings.errorSummary()).toBeFocused();
    await axe.check();
  });

  test('a short new password is refused before anything is sent', async ({ page, api }) => {
    const settings = new SettingsPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');

    await settings.currentPassword.fill('correct horse battery');
    await settings.newPassword.fill('kestrel');
    await settings.saveSettings.click();

    await expect(settings.fieldError('New password')).toHaveText('Use at least 12 characters.');
    expect(api.callsTo('PUT', '/api/account')).toHaveLength(0);
  });

  test('a wrong current password is refused on its field', async ({ page, api }) => {
    const settings = new SettingsPage(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');

    await settings.currentPassword.fill('not-my-password');
    await settings.newPassword.fill('kestrel-labs-2026');
    await settings.saveSettings.click();

    await expect(settings.fieldError('Current password')).toHaveText(
      'Your current password is incorrect.',
    );
  });

  test('with the current password the new one replaces it', async ({ page, api }) => {
    const settings = new SettingsPage(page);
    const grace = api.addAccount({ email: 'grace@example.org' });
    await api.signInAs(grace, '/settings');

    await settings.currentPassword.fill(grace.password);
    await settings.newPassword.fill('kestrel-labs-2026');
    await settings.saveSettings.click();

    await expect(
      settings.accountSaved('Your new password works from your next sign-in.'),
    ).toBeVisible();
    await expect(settings.currentPassword).toHaveValue('');
    await expect(settings.newPassword).toHaveValue('');
    expect(grace.password).toBe('kestrel-labs-2026');
  });

  // AC3: a confirmation dialog first; only confirming revokes every session, and Cancel leaves them signed in.
  test('Cancel leaves the member signed in', async ({ page, api, axe }) => {
    const settings = new SettingsPage(page);
    const dialog = new SignOutEverywhereDialog(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');

    await settings.signOutEverywhere.click();

    await expect(dialog.description).toBeVisible();
    await expect(dialog.cancel).toBeFocused();
    await axe.check();
    await dialog.cancel.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(settings.signOutEverywhere).toBeFocused();
    expect(api.callsTo('POST', '/api/account/sign-out-everywhere')).toHaveLength(0);
  });

  test('confirming ends every session and signs this browser out', async ({ page, api }) => {
    const settings = new SettingsPage(page);
    const dialog = new SignOutEverywhereDialog(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');

    await settings.signOutEverywhere.click();
    await dialog.confirm.click();

    await expect(new SignInPage(page).heading).toBeVisible();
    expect(api.callsTo('POST', '/api/account/sign-out-everywhere')).toHaveLength(1);
  });

  test('a failure keeps the member signed in and says so', async ({ page, api }) => {
    const settings = new SettingsPage(page);
    const dialog = new SignOutEverywhereDialog(page);
    await api.signInAs(api.addAccount({ email: 'grace@example.org' }), '/settings');
    api.on('POST', '/api/account/sign-out-everywhere', (route) => route.fulfill({ status: 500 }));

    await settings.signOutEverywhere.click();
    await dialog.confirm.click();

    await expect(dialog.failed).toContainText('You’re still signed in everywhere');
    await expect(dialog.dialog).toBeVisible();
  });
});
