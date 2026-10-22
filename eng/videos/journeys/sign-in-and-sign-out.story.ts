import { expect, test } from '../../../e2e/fixtures/app';
import { AppShell } from '../../../e2e/pages/app-shell.page';
import { HomePage } from '../../../e2e/pages/home.page';
import { SignInPage } from '../../../e2e/pages/sign-in.page';
import { Presenter, typeInto } from '../presenter';

// Journey: sign in and sign out (docs/detailed-designs/identity/sign-in-and-sign-out, L2-003).
test('sign-in-and-sign-out', async ({ page, api }) => {
  const show = await Presenter.start(page, 'sign-in-and-sign-out');
  const account = api.addAccount({ name: 'Grace Okonkwo', email: 'grace@example.org' });
  const signIn = new SignInPage(page);
  const shell = new AppShell(page);
  const home = new HomePage(page);

  await show.card('opening', 'opening', [
    'Sign in securely, and sign out cleanly',
    'Recorded against a local fake API · synthetic data',
  ]);

  await show.step('protected', async () => {
    await home.open();
    await expect(signIn.heading).toBeVisible();
  });

  await show.step('empty', async () => {
    await signIn.submitEmpty();
    await expect(signIn.emailError).toHaveText('Enter your email address.');
    await expect(signIn.passwordError).toHaveText('Enter your password.');
    await expect(signIn.email).toBeFocused();
  });

  await show.step('wrong-password', async () => {
    await typeInto(signIn.email, account.email);
    await typeInto(signIn.password, 'not-the-password');
    await signIn.submit.click();
    await expect(signIn.alert).toContainText('We couldn’t sign you in');
  });

  await show.step('sign-in', async () => {
    await typeInto(signIn.password, account.password);
    await signIn.submit.click();
    await expect(shell.accountMenu(account.name)).toBeVisible();
  });

  await show.step(
    'signed-in',
    async () => {
      await expect(page).toHaveURL(/\/$/);
      await expect(shell.navLink('Home')).toHaveAttribute('aria-current', 'page');
    },
    { poster: true },
  );

  await show.step('sign-out', async () => {
    await shell.signOut(account.name);
    await expect(signIn.heading).toBeVisible();
    expect(api.callsTo('POST', '/api/account/sign-out')).toHaveLength(1);
  });

  await show.step('still-signed-out', async () => {
    await home.open();
    await expect(signIn.heading).toBeVisible();
  });

  await show.card('closing', 'closing', [
    'Errors that never reveal which detail was wrong',
    'Authorization code flow with PKCE',
    'Sign out ends the session',
  ]);
  await show.finish();
});
