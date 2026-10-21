import { expect, test } from '../../fixtures/app';
import { SignUpPage } from '../../pages/sign-up.page';

// L2-001: anyone can create an account (docs/detailed-designs/identity/sign-up).
test.describe('Sign up', () => {
  test('a valid form creates the account and asks the visitor to check their inbox', async ({
    page,
    api,
    axe,
  }) => {
    const signUp = new SignUpPage(page);
    await signUp.open();
    await expect(signUp.heading).toBeVisible();
    await axe.check();

    await signUp.create('Leah Thompson', 'leah@example.org', 'a-long-enough-passphrase');

    await expect(signUp.checkInbox).toBeVisible();
    await expect(signUp.sentTo('leah@example.org')).toBeVisible();
    expect(api.callsTo('POST', '/api/account/sign-up')[0].body).toEqual({
      name: 'Leah Thompson',
      email: 'leah@example.org',
      password: 'a-long-enough-passphrase',
    });
    await axe.check();
  });

  test('a short password is caught before anything is sent', async ({ page, api, axe }) => {
    const signUp = new SignUpPage(page);
    await signUp.open();

    await signUp.create('Leah Thompson', 'leah@example.org', 'too-short');

    await expect(signUp.summary).toContainText('Fix 1 thing to create your account');
    await expect(signUp.passwordError).toHaveText(
      'Use at least 12 characters. A short phrase is easiest to remember.',
    );
    await expect(signUp.password).toBeFocused();
    expect(api.callsTo('POST', '/api/account/sign-up')).toHaveLength(0);
    await axe.check();
  });

  test('a breached password reported by the server shows on the password field', async ({
    page,
    api,
  }) => {
    api.on('POST', '/api/account/sign-up', (route) =>
      route.fulfill({
        status: 400,
        json: {
          status: 400,
          errors: {
            Password: ['This password has appeared in a data breach. Choose a different one.'],
          },
        },
      }),
    );
    const signUp = new SignUpPage(page);
    await signUp.open();

    await signUp.create('Leah Thompson', 'leah@example.org', 'correcthorsebatterystaple');

    await expect(signUp.passwordError).toHaveText(
      'This password has appeared in a data breach. Choose a different one.',
    );
    await expect(signUp.checkInbox).toHaveCount(0);
  });

  test('empty and malformed fields each get an error and focus moves to the first', async ({
    page,
  }) => {
    const signUp = new SignUpPage(page);
    await signUp.open();

    await signUp.create('', 'not-an-email', '');

    await expect(signUp.summary).toContainText('Fix 3 things to create your account');
    await expect(signUp.nameError).toHaveText('Enter your name.');
    await expect(signUp.emailError).toHaveText('Enter an email address like name@example.com.');
    await expect(signUp.passwordError).toHaveText('Enter a password.');
    await expect(signUp.name).toBeFocused();
  });

  test('a server failure keeps the details and says nothing was saved', async ({ page, api }) => {
    api.on('POST', '/api/account/sign-up', (route) =>
      route.fulfill({ status: 503, json: { status: 503 } }),
    );
    const signUp = new SignUpPage(page);
    await signUp.open();

    await signUp.create('Leah Thompson', 'leah@example.org', 'a-long-enough-passphrase');

    await expect(signUp.summary).toContainText('We couldn’t create your account');
    await expect(signUp.email).toHaveValue('leah@example.org');
  });

  test('the submit button is busy while the account is being created', async ({ page, api }) => {
    let release: () => void = () => undefined;
    api.on(
      'POST',
      '/api/account/sign-up',
      (route) =>
        new Promise<void>((resolve) => {
          release = () => void route.fulfill({ status: 202 }).then(resolve);
        }),
    );
    const signUp = new SignUpPage(page);
    await signUp.open();

    await signUp.create('Leah Thompson', 'leah@example.org', 'a-long-enough-passphrase');

    await expect(signUp.submit).toHaveAttribute('aria-busy', 'true');
    await expect(signUp.submit).toHaveText('Creating account…');
    release();
    await expect(signUp.checkInbox).toBeVisible();
  });
});
