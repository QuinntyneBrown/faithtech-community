import { expect, test } from '../../../e2e/fixtures/app';
import { SignUpPage } from '../../../e2e/pages/sign-up.page';
import { Presenter, typeInto } from '../presenter';

// Journey: sign up (docs/detailed-designs/identity/sign-up, L2-001). Synthetic details only.
test('sign-up', async ({ page }) => {
  const show = await Presenter.start(page, 'sign-up');
  const signUp = new SignUpPage(page);

  await show.card(
    'opening',
    'opening',
    ['Create an account with one short form', 'Recorded against a local fake API · synthetic data'],
    () => signUp.open(),
  );

  await show.step(
    'open-form',
    async () => {
      await expect(signUp.heading).toBeVisible();
      await typeInto(signUp.name, 'Leah Thompson');
      await typeInto(signUp.email, 'leah@example.org');
    },
    { position: 'top' },
  );

  await show.step(
    'short-password',
    async () => {
      await typeInto(signUp.password, 'too-short');
      await signUp.submit.click();
      await expect(signUp.summary).toContainText('Fix 1 thing to create your account');
      await expect(signUp.passwordError).toHaveText(
        'Use at least 12 characters. A short phrase is easiest to remember.',
      );
      await expect(signUp.password).toBeFocused();
    },
    { position: 'top' },
  );

  await show.step(
    'fix-password',
    async () => {
      await typeInto(signUp.password, 'a-long-enough-passphrase');
      await signUp.submit.click();
      await expect(signUp.checkInbox).toBeVisible();
    },
    { position: 'top' },
  );

  await show.step(
    'check-inbox',
    async () => {
      await expect(signUp.sentTo('leah@example.org')).toBeVisible();
    },
    { poster: true },
  );

  await show.card('closing', 'closing', [
    'One form: name, email and password',
    'Errors appear before anything is sent',
    'A verification link finishes the job',
  ]);
  await show.finish();
});
