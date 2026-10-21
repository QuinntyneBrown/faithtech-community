import { expect, test } from '../../../e2e/fixtures/app';
import { ForgotPasswordPage, ResetPasswordPage } from '../../../e2e/pages/password-reset.page';
import { SignInPage } from '../../../e2e/pages/sign-in.page';
import { Presenter, typeInto } from '../presenter';

// Journey: forgot and reset password (docs/detailed-designs/identity/password-reset, L2-004).
// The reset link is opened the way the email's link opens it; ids and tokens are fake.
test('password-reset', async ({ page, api }) => {
  const show = await Presenter.start(page, 'password-reset');
  const signIn = new SignInPage(page);
  const forgot = new ForgotPasswordPage(page);
  const reset = new ResetPasswordPage(page);

  await show.card(
    'opening',
    'opening',
    [
      'Get back in when you forget your password',
      'Recorded against a local fake API · synthetic data',
    ],
    () => signIn.open(),
  );

  await show.step('forgot-link', async () => {
    await expect(signIn.heading).toBeVisible();
    await signIn.forgotPassword.click();
    await expect(forgot.heading).toBeVisible();
  });

  await show.step('bad-email', async () => {
    await typeInto(forgot.email, 'grace');
    await forgot.submit.click();
    await expect(forgot.emailError).toHaveText('Enter an email like name@example.org.');
    await expect(forgot.email).toBeFocused();
  });

  await show.step('request', async () => {
    await typeInto(forgot.email, 'grace@example.org');
    await forgot.submit.click();
    await expect(forgot.checkEmail).toBeVisible();
    await expect(forgot.confirmationFor('grace@example.org')).toBeVisible();
  });

  await show.step('open-link', async () => {
    await reset.openLink('demo-user', 'demo-token');
    await expect(reset.heading).toBeVisible();
  });

  await show.step('mismatch', async () => {
    await typeInto(reset.password, 'too-short');
    await typeInto(reset.confirm, 'different');
    await reset.submit.click();
    await expect(reset.summary).toContainText('Fix 2 things to save your password');
    await expect(reset.passwordError).toHaveText('Use at least 12 characters.');
    await expect(reset.confirmError).toHaveText('This doesn’t match the password above.');
  });

  await show.step(
    'save',
    async () => {
      await typeInto(reset.password, 'a-brand-new-passphrase');
      await typeInto(reset.confirm, 'a-brand-new-passphrase');
      await reset.submit.click();
      await expect(reset.updated).toBeVisible();
    },
    { poster: true },
  );

  await show.step('expired', async () => {
    api.on('POST', '/api/account/reset-password', (route) =>
      route.fulfill({
        status: 400,
        json: {
          status: 400,
          errors: { Token: ['This link has expired or has already been used.'] },
        },
      }),
    );
    await reset.openLink('demo-user', 'used-token');
    await typeInto(reset.password, 'another-long-passphrase');
    await typeInto(reset.confirm, 'another-long-passphrase');
    await reset.submit.click();
    await expect(reset.expired).toBeVisible();
    await expect(reset.sendNewLink).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'The same answer for every address',
    'Clear errors on each field',
    'Other devices are signed out after a reset',
  ]);
  await show.finish();
});
